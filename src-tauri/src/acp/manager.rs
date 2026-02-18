use agent_client_protocol::{
    Agent, ClientCapabilities, ClientSideConnection, ContentBlock, Implementation,
    InitializeRequest, NewSessionRequest, PermissionOptionId, ProtocolVersion,
    RequestPermissionOutcome, SelectedPermissionOutcome, SessionId, TextContent,
};
use golaunch_core::Item;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use super::client::GoLaunchClient;
use super::types::{AgentConfig, AgentStatus, AgentUpdate, PermissionRequest};

pub struct AcpManager {
    status: AgentStatus,
    session_id: Option<SessionId>,
    prompt_tx: Option<mpsc::UnboundedSender<PromptCommand>>,
    cancel_tx: Option<mpsc::UnboundedSender<()>>,
    permission_resolve_tx: Option<mpsc::UnboundedSender<(String, String)>>,
    shutdown_tx: Option<mpsc::UnboundedSender<()>>,
}

enum PromptCommand {
    Prompt {
        session_id: SessionId,
        content: Vec<ContentBlock>,
    },
}

impl AcpManager {
    pub fn new() -> Self {
        Self {
            status: AgentStatus::Disconnected,
            session_id: None,
            prompt_tx: None,
            cancel_tx: None,
            permission_resolve_tx: None,
            shutdown_tx: None,
        }
    }

    pub fn status(&self) -> AgentStatus {
        self.status
    }

    pub async fn connect(&mut self, app: AppHandle, config: AgentConfig) -> Result<(), String> {
        if self.status == AgentStatus::Connected {
            return Ok(());
        }

        self.status = AgentStatus::Connecting;
        let _ = app.emit(
            "acp-update",
            AgentUpdate::StatusChange {
                status: AgentStatus::Connecting,
            },
        );

        let binary = if config.binary_path.is_empty() {
            return Err("No binary path configured".to_string());
        } else {
            config.binary_path.clone()
        };

        let args: Vec<String> = if config.args.is_empty() {
            vec![]
        } else {
            config
                .args
                .split_whitespace()
                .map(String::from)
                .collect()
        };

        let mut cmd = tokio::process::Command::new(&binary);
        cmd.args(&args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null());

        // Parse env vars from "KEY=VALUE,KEY2=VALUE2"
        if !config.env.is_empty() {
            for pair in config.env.split(',') {
                if let Some((k, v)) = pair.split_once('=') {
                    cmd.env(k.trim(), v.trim());
                }
            }
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn agent process: {e}"))?;

        let child_stdin = child.stdin.take().ok_or("Failed to get agent stdin")?;
        let child_stdout = child.stdout.take().ok_or("Failed to get agent stdout")?;

        // Channels for bridging async ACP events to Tauri
        let (update_tx, mut update_rx) = mpsc::unbounded_channel::<AgentUpdate>();
        let (permission_tx, mut permission_rx) = mpsc::unbounded_channel::<PermissionRequest>();
        let (prompt_tx, prompt_rx) = mpsc::unbounded_channel::<PromptCommand>();
        let (cancel_tx, cancel_rx) = mpsc::unbounded_channel::<()>();
        let (perm_resolve_tx, perm_resolve_rx) = mpsc::unbounded_channel::<(String, String)>();
        let (shutdown_tx, shutdown_rx) = mpsc::unbounded_channel::<()>();

        // Session initialization oneshot
        let (session_tx, session_rx) =
            tokio::sync::oneshot::channel::<Result<SessionId, String>>();

        // Spawn the ACP connection on a dedicated thread with LocalSet
        // (required because Client trait is !Send)
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            let local = tokio::task::LocalSet::new();

            local.block_on(&rt, async move {
                let acp_client = GoLaunchClient::new(update_tx.clone(), permission_tx);
                let pending_perms = acp_client.pending_permissions();

                let stdin_async =
                    tokio_util::compat::TokioAsyncWriteCompatExt::compat_write(child_stdin);
                let stdout_async =
                    tokio_util::compat::TokioAsyncReadCompatExt::compat(child_stdout);

                let (connection, io_future) = ClientSideConnection::new(
                    acp_client,
                    stdin_async,
                    stdout_async,
                    |fut| {
                        tokio::task::spawn_local(fut);
                    },
                );

                // Spawn I/O handler
                tokio::task::spawn_local(async move {
                    if let Err(e) = io_future.await {
                        eprintln!("ACP I/O error: {e:?}");
                    }
                });

                // Initialize the connection
                let init_result = connection
                    .initialize(
                        InitializeRequest::new(ProtocolVersion::LATEST)
                            .client_info(Implementation::new("GoLaunch", "0.1.0"))
                            .client_capabilities(ClientCapabilities::new()),
                    )
                    .await;

                if let Err(e) = init_result {
                    let _ = session_tx.send(Err(format!("Initialize failed: {e:?}")));
                    return;
                }

                // Create a new session
                let cwd = std::env::current_dir().unwrap_or_else(|_| "/".into());
                let session_result = connection.new_session(NewSessionRequest::new(cwd)).await;

                let session_id = match session_result {
                    Ok(resp) => resp.session_id,
                    Err(e) => {
                        let _ = session_tx.send(Err(format!("New session failed: {e:?}")));
                        return;
                    }
                };

                let _ = session_tx.send(Ok(session_id.clone()));

                // Handle permission resolves from the Tauri thread
                let pending_perms_clone = pending_perms.clone();
                let mut perm_resolve_rx = perm_resolve_rx;
                tokio::task::spawn_local(async move {
                    while let Some((request_id, option_id)) = perm_resolve_rx.recv().await {
                        if let Some(responder) =
                            pending_perms_clone.borrow_mut().remove(&request_id)
                        {
                            let outcome = RequestPermissionOutcome::Selected(
                                SelectedPermissionOutcome::new(PermissionOptionId::new(option_id)),
                            );
                            let _ = responder.send(outcome);
                        }
                    }
                });

                // Handle prompts from the Tauri thread
                let mut prompt_rx = prompt_rx;
                tokio::task::spawn_local(async move {
                    while let Some(cmd) = prompt_rx.recv().await {
                        match cmd {
                            PromptCommand::Prompt {
                                session_id,
                                content,
                            } => {
                                let result = connection
                                    .prompt(
                                        agent_client_protocol::PromptRequest::new(
                                            session_id, content,
                                        ),
                                    )
                                    .await;

                                match result {
                                    Ok(resp) => {
                                        let _ = update_tx.send(AgentUpdate::TurnComplete {
                                            stop_reason: format!("{:?}", resp.stop_reason),
                                        });
                                    }
                                    Err(e) => {
                                        let _ = update_tx.send(AgentUpdate::TurnComplete {
                                            stop_reason: format!("Error: {e:?}"),
                                        });
                                    }
                                }
                            }
                        }
                    }
                });

                // Handle cancels
                let pending_perms_cancel = pending_perms;
                let mut cancel_rx = cancel_rx;
                tokio::task::spawn_local(async move {
                    while let Some(()) = cancel_rx.recv().await {
                        // Cancel all pending permissions
                        let mut perms = pending_perms_cancel.borrow_mut();
                        for (_id, responder) in perms.drain() {
                            let _ = responder.send(RequestPermissionOutcome::Cancelled);
                        }
                    }
                });

                // Wait for shutdown signal
                let mut shutdown_rx = shutdown_rx;
                shutdown_rx.recv().await;

                // Kill the child process
                let _ = child.kill().await;
            });
        });

        // Wait for session initialization
        let session_id = session_rx
            .await
            .map_err(|_| "Connection thread died".to_string())?
            .map_err(|e| e)?;

        self.session_id = Some(session_id);
        self.prompt_tx = Some(prompt_tx);
        self.cancel_tx = Some(cancel_tx);
        self.permission_resolve_tx = Some(perm_resolve_tx);
        self.shutdown_tx = Some(shutdown_tx);
        self.status = AgentStatus::Connected;

        let _ = app.emit(
            "acp-update",
            AgentUpdate::StatusChange {
                status: AgentStatus::Connected,
            },
        );

        // Spawn background tasks to forward updates and permissions to Tauri events
        let app_for_updates = app.clone();
        tokio::spawn(async move {
            while let Some(update) = update_rx.recv().await {
                let _ = app_for_updates.emit("acp-update", &update);
            }
        });

        let app_for_perms = app;
        tokio::spawn(async move {
            while let Some(perm) = permission_rx.recv().await {
                let _ = app_for_perms.emit("acp-permission-request", &perm);
            }
        });

        Ok(())
    }

    pub async fn disconnect(&mut self) -> Result<(), String> {
        // Signal the connection thread to shut down
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }

        self.prompt_tx.take();
        self.cancel_tx.take();
        self.permission_resolve_tx.take();
        self.session_id.take();

        self.status = AgentStatus::Disconnected;
        Ok(())
    }

    pub async fn prompt(&mut self, query: &str, context_items: &[Item]) -> Result<(), String> {
        let session_id = self
            .session_id
            .clone()
            .ok_or("Not connected to agent")?;
        let prompt_tx = self
            .prompt_tx
            .as_ref()
            .ok_or("Not connected to agent")?;

        // Build context string from launcher items
        let mut prompt_text = String::new();
        if !context_items.is_empty() {
            prompt_text.push_str("Available launcher items:\n");
            for item in context_items {
                prompt_text.push_str(&format!(
                    "- {} [{}]: {} (category: {})\n",
                    item.title, item.action_type, item.action_value, item.category
                ));
            }
            prompt_text.push('\n');
        }
        prompt_text.push_str(&format!("User query: {query}"));

        let content = vec![ContentBlock::Text(TextContent::new(prompt_text))];

        prompt_tx
            .send(PromptCommand::Prompt {
                session_id,
                content,
            })
            .map_err(|_| "Failed to send prompt to agent".to_string())
    }

    pub async fn cancel(&mut self) -> Result<(), String> {
        let cancel_tx = self
            .cancel_tx
            .as_ref()
            .ok_or("Not connected to agent")?;

        cancel_tx
            .send(())
            .map_err(|_| "Failed to send cancel to agent".to_string())
    }

    pub async fn resolve_permission(
        &mut self,
        request_id: &str,
        option_id: &str,
    ) -> Result<(), String> {
        let tx = self
            .permission_resolve_tx
            .as_ref()
            .ok_or("Not connected to agent")?;

        tx.send((request_id.to_string(), option_id.to_string()))
            .map_err(|_| "Failed to resolve permission".to_string())
    }
}

import { useEffect } from "react";
import type { PermissionRequest } from "../types";

interface PermissionDialogProps {
  request: PermissionRequest;
  onResolve: (requestId: string, optionId: string) => void;
}

export function PermissionDialog({ request, onResolve }: PermissionDialogProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && request.options.length > 0) {
        e.preventDefault();
        onResolve(request.request_id, request.options[0].option_id);
      } else if (e.key === "Escape" && request.options.length > 1) {
        e.preventDefault();
        onResolve(
          request.request_id,
          request.options[request.options.length - 1].option_id
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [request, onResolve]);

  return (
    <div className="permission-dialog">
      <div className="permission-header">
        <span className="permission-icon">&#9888;</span>
        <span className="permission-title">{request.tool_name}</span>
      </div>
      {request.tool_description && (
        <div className="permission-description">{request.tool_description}</div>
      )}
      {request.command_preview && (
        <pre className="permission-preview">{request.command_preview}</pre>
      )}
      <div className="permission-actions">
        {request.options.map((option) => (
          <button
            key={option.option_id}
            className={`permission-btn ${option.kind.toLowerCase().includes("allow") || option.kind.toLowerCase().includes("approve") ? "permission-btn-approve" : "permission-btn-deny"}`}
            onClick={() => onResolve(request.request_id, option.option_id)}
          >
            {option.name}
          </button>
        ))}
      </div>
      <div className="permission-hint">Enter = approve, Esc = deny</div>
    </div>
  );
}

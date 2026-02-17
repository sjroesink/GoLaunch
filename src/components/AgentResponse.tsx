import { useEffect, useRef } from "react";

interface AgentResponseProps {
  messages: string;
  thoughts: string;
  isThinking: boolean;
  turnActive: boolean;
}

export function AgentResponse({
  messages,
  thoughts,
  isThinking,
  turnActive,
}: AgentResponseProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thoughts]);

  return (
    <div className="agent-response" ref={scrollRef}>
      {isThinking && !messages && (
        <div className="agent-thinking">
          <span className="thinking-dots">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
          {thoughts && (
            <div className="agent-thought">{thoughts}</div>
          )}
        </div>
      )}
      {messages && (
        <div className="agent-message">{messages}</div>
      )}
      {turnActive && messages && (
        <div className="agent-streaming-indicator" />
      )}
    </div>
  );
}

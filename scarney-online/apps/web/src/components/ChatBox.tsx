import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/chatStore.js';

interface Props {
  roomId: string;
}

export default function ChatBox({ roomId }: Props) {
  const { messages, sendMessage } = useChatStore();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(roomId, text);
    setText('');
  };

  return (
    <div className="chat-box">
      <div className="chat-box__messages">
        {messages.map(m => (
          <div key={m.id} className="chat-message">
            <span className="chat-message__user">{m.username}:</span>
            <span className="chat-message__text">{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-box__form" onSubmit={submit}>
        <input
          className="input"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="メッセージを入力..."
          maxLength={200}
        />
        <button type="submit" className="btn btn-primary btn-sm">送信</button>
      </form>
    </div>
  );
}

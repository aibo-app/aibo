import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Panel, SectionTitle } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { API_BASE } from '../lib/api';
import { createLogger } from '../utils/logger';

const log = createLogger('ChatPage');

interface Message {
    id: number;
    conversationId: number;
    role: 'user' | 'assistant';
    content: string;
    metadata?: {
        toolCalls?: string[];
        skills?: string[];
        actions?: any[];
    };
    createdAt: number;
}

interface Conversation {
    id: number;
    title: string;
    createdAt: number;
    updatedAt: number;
    lastMessage?: string;
}

export const ChatPage: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch conversations on mount
    useEffect(() => {
        loadConversations();
    }, []);

    // Load messages when conversation changes
    useEffect(() => {
        if (currentConversationId) {
            loadMessages(currentConversationId);
        }
    }, [currentConversationId]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadConversations = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/chat/conversations`);
            const data = await response.json();
            setConversations(data.conversations || []);

            // If no conversations, create one
            if (!data.conversations || data.conversations.length === 0) {
                await createNewConversation();
            } else {
                // Select the most recent conversation
                setCurrentConversationId(data.conversations[0].id);
            }
        } catch (error) {
            log.error('Failed to load conversations:', error);
        }
    };

    const loadMessages = async (conversationId: number) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/chat/${conversationId}/messages`);
            const data = await response.json();
            setMessages(data.messages || []);
        } catch (error) {
            log.error('Failed to load messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const createNewConversation = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/chat/new`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'New Conversation' })
            });
            const data = await response.json();
            setConversations([data.conversation, ...conversations]);
            setCurrentConversationId(data.conversation.id);
            setMessages([]);
        } catch (error) {
            log.error('Failed to create conversation:', error);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || !currentConversationId || sending) return;

        const userMessage = input.trim();
        setInput('');
        setSending(true);

        // Optimistic: show user message immediately
        const optimisticId = -Date.now();
        const optimisticUserMsg: Message = {
            id: optimisticId,
            conversationId: currentConversationId,
            role: 'user',
            content: userMessage,
            createdAt: Date.now()
        };
        setMessages(prev => [...prev, optimisticUserMsg]);

        try {
            const response = await fetch(`${API_BASE}/api/chat/${currentConversationId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const data = await response.json();

            // Replace optimistic message with real one and add assistant response
            setMessages(prev => [
                ...prev.filter(m => m.id !== optimisticId),
                data.userMsg,
                data.assistantMsg
            ]);

            // Refresh conversations list to update timestamps
            loadConversations();
        } catch (error) {
            log.error('Failed to send message:', error);
            // Remove optimistic message and restore input
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            setInput(userMessage);
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) {
            return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } else if (isYesterday) {
            return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    return (
        <div className="flex-1 flex flex-col p-8 overflow-hidden bg-beige custom-scrollbar pb-10">
            <PageHeader
                title="AI Interface"
                subtitle="Communicate with your neural portfolio assistant"
            >
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-white shadow-soft">
                    <span className="size-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Neural Engine Online</span>
                </div>
            </PageHeader>

            <div className="flex-1 flex gap-6 overflow-hidden mt-2">
                {/* Sidebar History */}
                <section className="w-80 flex flex-col shrink-0 h-full">
                    <Panel className="p-6 flex flex-col gap-4 flex-1 bg-white">
                        <SectionTitle
                            title="Conversations"
                            icon="history"
                            action={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-8 !p-0"
                                    onClick={createNewConversation}
                                >
                                    <span className="material-symbols-outlined text-base">add</span>
                                </Button>
                            }
                        />
                        <div className="overflow-y-auto flex-1 pr-1 space-y-1 custom-scrollbar">
                            {conversations.map(convo => (
                                <div
                                    key={convo.id}
                                    className={`group p-2.5 rounded-xl cursor-pointer transition-all border ${
                                        currentConversationId === convo.id
                                            ? 'bg-primary/5 border-primary/20 shadow-sm'
                                            : 'hover:bg-beige/40 border-transparent hover:border-black/5 hover:shadow-sm'
                                    }`}
                                    onClick={() => setCurrentConversationId(convo.id)}
                                >
                                    <div className="text-[11px] text-text-muted/60 font-semibold mb-0.5 font-mono">
                                        {formatTime(convo.updatedAt)}
                                    </div>
                                    <div className="text-xs font-bold text-text-main line-clamp-2 leading-snug tracking-tight">
                                        {convo.title}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </section>

                {/* Main Chat Area */}
                <Panel className="flex-1 flex flex-col bg-white overflow-hidden">
                    <div className="p-6 pb-0">
                        <SectionTitle
                            title="Primary Stream"
                            icon="smart_toy"
                            action={
                                <span className="text-[10px] text-text-muted/40 font-semibold uppercase tracking-widest italic leading-none flex items-center gap-1.5">
                                    <span className="size-1.5 bg-green-500 rounded-full animate-pulse"></span> Live
                                </span>
                            }
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-text-main">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-text-muted/40 text-sm font-semibold">Loading messages...</div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center max-w-md">
                                    <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-3xl text-primary">smart_toy</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-text-main mb-2">Start a conversation</h3>
                                    <p className="text-sm text-text-muted/60">Ask about your portfolio, check prices, or get market insights.</p>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={msg.id || idx} className="flex gap-6 max-w-4xl mx-auto">
                                    {msg.role === 'user' ? (
                                        <div className="size-11 rounded-xl bg-gray-100 border border-black/5 shrink-0 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-xl text-text-muted">person</span>
                                        </div>
                                    ) : (
                                        <div className="size-11 rounded-xl bg-primary flex items-center justify-center shrink-0 text-white shadow-sm">
                                            <span className="material-symbols-outlined text-2xl">smart_toy</span>
                                        </div>
                                    )}

                                    <div className="flex-1">
                                        <div className={`p-6 rounded-2xl border border-black/5 leading-relaxed text-sm font-medium bg-white ${msg.role === 'assistant' ? 'chat-markdown' : ''}`}>
                                            {msg.role === 'assistant' ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                            ) : (
                                                <p className="tracking-tight whitespace-pre-wrap">{msg.content}</p>
                                            )}

                                            {/* Show skills/tools used */}
                                            {msg.metadata && (msg.metadata.skills || msg.metadata.toolCalls) && (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {msg.metadata.skills?.map((skill, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">extension</span>
                                                            {skill}
                                                        </span>
                                                    ))}
                                                    {msg.metadata.toolCalls?.map((tool, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-text-muted text-xs font-bold"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">build</span>
                                                            {tool}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-semibold text-text-muted/30 uppercase tracking-[0.2em] block mt-2 ml-1">
                                            {formatTime(msg.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Loading indicator for assistant response */}
                        {sending && (
                            <div className="flex gap-6 max-w-4xl mx-auto">
                                <div className="size-11 rounded-xl bg-primary flex items-center justify-center shrink-0 text-white shadow-sm">
                                    <span className="material-symbols-outlined text-2xl">smart_toy</span>
                                </div>
                                <div className="flex-1">
                                    <div className="p-6 rounded-2xl border border-black/5 bg-white">
                                        <div className="flex items-center gap-2">
                                            <div className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                            <div className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                            <div className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-6 pt-4 bg-white border-t border-gray-100 shrink-0">
                        <div className="max-w-4xl mx-auto relative px-4">
                            <div className="bg-gray-50 p-2.5 flex items-end gap-3 rounded-2xl border border-black/5 shadow-inset">
                                <textarea
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-text-main placeholder:text-text-muted/40 text-sm font-bold resize-none py-4 max-h-32 outline-none tracking-tight"
                                    placeholder="Ask about your portfolio..."
                                    rows={1}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    disabled={sending || !currentConversationId}
                                ></textarea>
                                <Button
                                    variant="primary"
                                    className="size-11 !p-0 shrink-0 mb-1 mr-1"
                                    onClick={sendMessage}
                                    disabled={!input.trim() || sending || !currentConversationId}
                                >
                                    <span className="material-symbols-outlined text-xl">send</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    );
};

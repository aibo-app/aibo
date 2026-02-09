import React, { useState } from 'react';

const MOCK_CHATS = [
    { id: 1, text: "Best performing asset this month?", time: "Today, 10:42 AM" },
    { id: 2, text: "Explain recent Ethereum gas spike", time: "Yesterday, 4:15 PM" },
    { id: 3, text: "Review my portfolio diversification", time: "Sep 28, 9:20 AM" },
    { id: 4, text: "Solana vs Cardano comparison", time: "Sep 25, 2:30 PM" },
];

export const ChatPage: React.FC = () => {
    const [messages] = useState([
        { role: 'user', content: 'What is my best performing asset this month?', time: '10:42 AM' },
        {
            role: 'assistant',
            content: 'Based on your portfolio data, Bitcoin (BTC) is currently your top performer for the month. Here is a breakdown of the growth metrics:',
            time: '10:42 AM',
            table: true
        }
    ]);
    const [input, setInput] = useState('');

    return (
        <div className="flex-1 flex overflow-hidden bg-beige p-6 gap-6 h-full">
            {/* Sidebar History */}
            <section className="w-80 flex flex-col gap-6 shrink-0 h-full">
                <div className="soft-panel p-5 flex flex-col gap-4 flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                        <span className="material-symbols-outlined text-text-muted">history</span>
                        <h2 className="font-display font-bold text-lg text-text-main">Recent</h2>
                    </div>
                    <div className="overflow-y-auto flex-1 pr-1 space-y-3 custom-scrollbar">
                        {MOCK_CHATS.map(chat => (
                            <div key={chat.id} className="group p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                <div className="text-xs text-text-muted font-semibold mb-1">{chat.time}</div>
                                <div className="text-sm font-medium text-text-main line-clamp-2">{chat.text}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="soft-panel p-5 flex flex-col gap-4 h-1/3 shrink-0">
                    <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                        <span className="material-symbols-outlined text-text-muted">push_pin</span>
                        <h2 className="font-display font-bold text-lg text-text-main">Pinned</h2>
                    </div>
                    <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                        {['Market Overview', 'Risk Analysis', 'Daily Summary'].map((item, i) => (
                            <button key={i} className="w-full text-left p-2.5 rounded-lg bg-gray-50 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all text-sm font-medium text-text-main flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">trending_up</span>
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Main Chat Area */}
            <section className="flex-1 soft-panel flex flex-col relative overflow-hidden">
                <header className="flex justify-between items-center p-6 border-b border-gray-100 bg-white/50 backdrop-blur-sm z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">smart_toy</span>
                        </div>
                        <div>
                            <h1 className="font-display font-bold text-xl text-text-main">Neural Core</h1>
                            <p className="text-xs text-text-muted font-medium flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                                Online • v2.4 Active
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="size-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-text-muted transition-colors border border-gray-200">
                            <span className="material-symbols-outlined text-sm">more_horiz</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gradient-to-b from-white to-gray-50/50 custom-scrollbar">
                    {messages.map((msg, idx) => (
                        <div key={idx} className="flex gap-4 max-w-3xl mx-auto">
                            {msg.role === 'user' ? (
                                <div className="size-10 rounded-full bg-white shadow-soft border border-white shrink-0 overflow-hidden" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDRbhgyUn6jkW20dDOnMpH_1-jPlYOa9Zl1YeFV9bYc4MUus5PTlyqty73mOkBOGSlc5xFq1dorT5OLlELpT-8b73OvnHS1jiMs8BwIQ--bV-YL-IS_kwsKx_eSIv0sEZ-wn022kvrUq1v7pe7MFjtsWlryPULlmLs0yBlDjzbly_UW9_WVLnOhCB9ZhSLOiY8FCGK1_ozB7KiBAJe4h-ZsCWP_12tEOiVAVfkTo_rJlA1ya86XNG0LAXBuZP4oLPdehoFs-D4AQFc")', backgroundSize: 'cover' }}></div>
                            ) : (
                                <div className="size-10 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-soft text-white">
                                    <span className="material-symbols-outlined text-xl">smart_toy</span>
                                </div>
                            )}

                            <div className="flex-1">
                                <div className={`p-4 rounded-xl shadow-sm border border-gray-100 inline-block ${msg.role === 'user' ? 'bg-white rounded-tl-none' : 'bg-white rounded-tl-none shadow-soft'}`}>
                                    <p className="text-text-main text-sm leading-relaxed mb-1">{msg.content}</p>

                                    {msg.table && (
                                        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50/50 my-4 w-full">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-100 text-xs uppercase text-text-muted font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3 font-display tracking-wider">Asset</th>
                                                        <th className="px-4 py-3 font-display tracking-wider text-right">Price</th>
                                                        <th className="px-4 py-3 font-display tracking-wider text-right">Growth</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 bg-white">
                                                    <tr>
                                                        <td className="px-4 py-3 font-medium text-text-main">Bitcoin</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">$68,420</td>
                                                        <td className="px-4 py-3 text-right tabular-nums text-green-600 font-bold">+18.4%</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-3 font-medium text-text-main">Solana</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">$148.89</td>
                                                        <td className="px-4 py-3 text-right tabular-nums text-green-600 font-bold">+12.4%</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium block mt-1 ml-1">{msg.time}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 pt-2 bg-white/50 backdrop-blur-sm shrink-0">
                    <div className="max-w-3xl mx-auto relative">
                        <div className="shadow-well bg-[#ece9d8] rounded-2xl p-2 flex items-end gap-2 border border-black/5">
                            <button className="p-2 text-text-muted hover:text-primary transition-colors mb-0.5 ml-1">
                                <span className="material-symbols-outlined">add_circle</span>
                            </button>
                            <textarea
                                className="w-full bg-transparent border-none focus:ring-0 text-text-main placeholder:text-text-muted/70 text-sm resize-none py-3 max-h-32 outline-none"
                                placeholder="Ask anything about your crypto assets..."
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                            ></textarea>
                            <button className="p-2 mb-0.5 rounded-xl bg-primary text-white shadow-button hover:bg-primary/90 transition-all flex items-center justify-center">
                                <span className="material-symbols-outlined">send</span>
                            </button>
                        </div>
                        <p className="text-center text-[10px] text-text-muted mt-3 font-medium">Aibō can make mistakes. Please verify important financial information.</p>
                    </div>
                </div>
            </section>
        </div>
    );
};

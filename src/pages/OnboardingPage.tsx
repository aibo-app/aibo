import { useState } from 'react';
import { Wallet, Shield, Zap, Monitor, ArrowRight, Loader2, Sparkles, Settings } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { WindowControls, MacWindowControls } from '../components/layout/WindowControls';

interface OnboardingPageProps {
    onComplete: (address: string) => void;
}

export const OnboardingPage = ({ onComplete }: OnboardingPageProps) => {
    const platform = window.electronAPI?.platform || 'darwin';
    const isMac = platform === 'darwin';

    const [address, setAddress] = useState('');
    const [chainType, setChainType] = useState<'evm' | 'solana'>('evm');
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState('');

    const handleAddressChange = (value: string) => {
        setAddress(value);
        setError('');

        if (value.startsWith('0x')) {
            setChainType('evm');
        } else if (value.length >= 32 && !value.includes(' ')) {
            setChainType('solana');
        }
    };

    const handleInitialize = async () => {
        const isSolana = chainType === 'solana';
        const minLength = isSolana ? 32 : 40;

        if (!address || address.length < minLength) {
            setError(`Invalid ${chainType === 'evm' ? 'EVM' : 'Solana'} Address.`);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:3001/api/wallets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address, chainType, label: 'Primary Wallet' }),
            });

            if (response.ok) {
                setScanning(true);
                await new Promise(resolve => setTimeout(resolve, 2000));
                onComplete(address);
            } else {
                const data = await response.json();
                setError(data.error || 'System Error.');
            }
        } catch {
            setError('Connection Error.');
        } finally {
            setLoading(false);
            setScanning(false);
        }
    };

    return (
        <div className="page-container flex-col items-center justify-center p-6 h-screen bg-base relative overflow-hidden">

            <div className="flex-col gap-6 w-full max-w-[420px] relative z-10">

                {/* LOGO / HEADER */}
                <div className="text-center group">
                    <div className="inline-flex p-3 bg-accent rounded-xl text-white mb-4 shadow-xl border border-white/20 transition-all">
                        <Sparkles size={32} />
                    </div>
                    <div className="text-active font-bold tracking-tight mb-1" style={{ fontSize: '36px', lineHeight: '1', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>Aibō</div>
                    <p className="text-[10px] text-muted font-semibold tracking-tight opacity-40">Professional OS</p>
                </div>

                <Card padding="none" className="flex-col overflow-hidden shadow-2xl" style={{ borderRadius: '6px' }}>
                    <div className="title-bar shrink-0" style={{ background: 'transparent', padding: '10px 14px' }}>
                        <div className="flex-row items-center gap-3">
                            {isMac && <div className="flex-row gap-1.5"><MacWindowControls /></div>}
                            <div className="h-4 w-px bg-bevel-shadow opacity-40 mx-1" />
                            <Monitor size={13} className="text-accent" />
                            <span className="text-xs font-bold text-muted">Setup Portal</span>
                        </div>
                        <div className="flex-row gap-1">
                            {!isMac && <WindowControls />}
                        </div>
                    </div>

                    <div className="p-6 flex-col gap-6 bg-base">
                        <div className="text-[12px] leading-relaxed text-secondary font-medium opacity-80 border-l-2 border-accent pl-4">
                            Port 3001 Connected. Please enter your primary address to begin tracking your assets.
                        </div>

                        <div className="flex-col gap-2">
                            <div className="label-sm opacity-60 flex-row items-center gap-2">
                                <Settings size={12} /> Network
                            </div>
                            <div className="flex-row gap-2">
                                {(['Ethereum', 'Solana'] as const).map((type) => (
                                    <Button
                                        key={type}
                                        variant={chainType === (type.toLowerCase() as 'evm' | 'solana') ? 'primary' : 'ghost'}
                                        onClick={() => setChainType(type.toLowerCase() as 'evm' | 'solana')}
                                        style={{ height: '36px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}
                                        className="flex-1"
                                    >
                                        {type}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-col gap-2">
                            <div className="label-sm opacity-60 flex-row items-center gap-2">
                                <Wallet size={12} /> Address
                            </div>
                            <div className="panel-inset flex-row items-center px-4 bg-inset" style={{ height: '42px', borderRadius: '6px' }}>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => handleAddressChange(e.target.value)}
                                    placeholder={chainType === 'evm' ? "0x..." : "Solana address..."}
                                    className="flex-1 bg-transparent border-none outline-none font-bold text-sm text-active"
                                    style={{ fontFamily: 'var(--font-display)' }}
                                />
                            </div>
                            {error && <div className="text-[10px] text-danger font-bold uppercase tracking-tight">{error}</div>}
                        </div>

                        <Button
                            variant="accent"
                            onClick={handleInitialize}
                            disabled={loading || scanning}
                            style={{ height: '48px', borderRadius: '6px', fontSize: '13px', fontWeight: '700' }}
                            className="w-full shadow-lg group"
                        >
                            {loading || scanning ? (
                                <div className="flex-row items-center gap-3">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Syncing...</span>
                                </div>
                            ) : (
                                <div className="flex-row items-center justify-center gap-2">
                                    Start Dashboard <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            )}
                        </Button>

                        <div className="text-center pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => onComplete('demoMode')}
                                style={{ height: '22px', fontSize: '10px', fontWeight: '600' }}
                                className="opacity-50 hover:opacity-100"
                            >
                                Continue to Demo Mode
                            </Button>
                        </div>
                    </div>

                    <div className="bg-inset p-3 border-t border-bevel-shadow flex-row gap-4 justify-center">
                        <div className="text-[10px] text-muted font-semibold flex-row items-center gap-2">
                            <Shield size={12} className="text-success" /> Secure
                        </div>
                        <div className="text-[10px] text-muted font-semibold flex-row items-center gap-2">
                            <Zap size={12} className="text-accent" /> Local
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

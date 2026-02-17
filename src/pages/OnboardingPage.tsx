import { useState } from 'react';
import { Wallet, Shield, Zap, ArrowRight, Loader2, Settings } from 'lucide-react';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { WindowControls, MacWindowControls } from '../components/layout/WindowControls';
import { Logo } from '../components/common/Logo';
import { API_BASE } from '../lib/api';
import { TIMEOUTS } from '../lib/constants';

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
            setError(`Invalid ${chainType === 'evm' ? 'Base' : 'Solana'} Address.`);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE}/api/wallets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address, chainType, label: 'Primary Wallet' }),
            });

            if (response.ok) {
                setScanning(true);
                await new Promise(resolve => setTimeout(resolve, TIMEOUTS.ONBOARDING_REDIRECT));
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
        <div className="flex flex-col items-center justify-center p-6 h-screen bg-beige relative overflow-hidden">

            <div className="flex flex-col gap-6 w-full max-w-[420px] relative z-10">

                {/* Logo / Header */}
                <div className="text-center">
                    <div className="inline-flex p-3 bg-primary rounded-xl text-white mb-4 shadow-xl border border-white/20">
                        <Logo className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-text-main font-display leading-none mb-1">Aibo</h1>
                    <p className="text-[10px] text-text-muted font-semibold tracking-tight opacity-40">Professional OS</p>
                </div>

                <Panel className="flex flex-col overflow-hidden shadow-xl">
                    {/* Title bar */}
                    <div className="flex items-center justify-between shrink-0 px-4 py-2.5 border-b border-black/5">
                        <div className="flex items-center gap-3">
                            {isMac && <MacWindowControls />}
                            <div className="h-4 w-px bg-black/10 mx-1" />
                            <span className="material-symbols-outlined text-primary text-sm">monitor</span>
                            <span className="text-xs font-bold text-text-muted">Setup Portal</span>
                        </div>
                        <div className="flex gap-1">
                            {!isMac && <WindowControls />}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6 flex flex-col gap-6">
                        <div className="text-xs leading-relaxed text-text-muted font-medium border-l-2 border-primary pl-4">
                            Port 3001 Connected. Please enter your primary address to begin tracking your assets.
                        </div>

                        {/* Network selector */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted flex items-center gap-2">
                                <Settings size={12} /> Network
                            </label>
                            <div className="flex gap-2">
                                {(['Base', 'Solana'] as const).map((type) => (
                                    <Button
                                        key={type}
                                        variant={chainType === (type === 'Base' ? 'evm' : 'solana') ? 'primary' : 'ghost'}
                                        size="sm"
                                        onClick={() => setChainType(type === 'Base' ? 'evm' : 'solana')}
                                        className="flex-1 h-9"
                                    >
                                        {type}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Address input */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted flex items-center gap-2">
                                <Wallet size={12} /> Address
                            </label>
                            <div className="panel-inset flex items-center px-4 bg-gray-50 rounded-lg h-11">
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => handleAddressChange(e.target.value)}
                                    placeholder={chainType === 'evm' ? "0x..." : "Solana address..."}
                                    className="flex-1 bg-transparent border-none outline-none font-bold text-sm text-text-main font-display"
                                />
                            </div>
                            {error && <div className="text-[10px] text-red-500 font-bold uppercase tracking-tight">{error}</div>}
                        </div>

                        {/* Submit */}
                        <Button
                            variant="primary"
                            onClick={handleInitialize}
                            disabled={loading || scanning}
                            className="w-full h-12 text-sm shadow-lg group"
                        >
                            {loading || scanning ? (
                                <div className="flex items-center gap-3">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Syncing...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    Start Dashboard <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            )}
                        </Button>

                        {/* Demo mode link */}
                        <div className="text-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onComplete('demoMode')}
                                className="opacity-50 hover:opacity-100"
                            >
                                Continue to Demo Mode
                            </Button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 p-3 border-t border-black/5 flex gap-4 justify-center">
                        <div className="text-[10px] text-text-muted font-semibold flex items-center gap-2">
                            <Shield size={12} className="text-green-500" /> Secure
                        </div>
                        <div className="text-[10px] text-text-muted font-semibold flex items-center gap-2">
                            <Zap size={12} className="text-primary" /> Local
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    );
};

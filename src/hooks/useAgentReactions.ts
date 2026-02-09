import { useEffect } from 'react';
import { useData } from './useData';
import { useTheme } from './useTheme';

/**
 * useAgentReactions centralizes all UI side-effects triggered by the OpenClaw Brain.
 * This includes status color changes, sounds (future), or auto-navigation.
 */
export function useAgentReactions() {
    const { agentAction } = useData();
    const { setAccentOverride } = useTheme();

    useEffect(() => {
        if (!agentAction) return;

        switch (agentAction.action) {
            case 'set_status_color':
                const color = agentAction.data?.color;
                if (color) {
                    console.log('🌈 [Reaction] Setting status color:', color);
                    setAccentOverride(color);

                    // Revert to default after a timeout
                    const duration = agentAction.data?.duration || 10000;
                    const timer = setTimeout(() => setAccentOverride(null), duration);
                    return () => clearTimeout(timer);
                }
                break;

            case 'notify':
                // Could integrate with a global toast system here
                console.log('🔔 [Reaction] Notification:', agentAction.data?.message);
                break;

            default:
                console.warn('⚠️ [Reaction] Unknown agent action:', agentAction.action);
        }
    }, [agentAction, setAccentOverride]);
}

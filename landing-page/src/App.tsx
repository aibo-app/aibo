import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import LandingAgent from './components/LandingAgent';
import {
    ShieldCheck,
    TrendingUp,
    Download,
    Activity,
    ArrowRight,
    Zap,
    Layers,
    Search,
    Settings,
    MousePointer2,
    Lock,
    Boxes,
    Cpu,
    X,
    MessageSquare,
    Users
} from 'lucide-react';

export default function App() {
    const [expression, setExpression] = useState<'neutral' | 'happy' | 'alert' | 'thinking'>('neutral');
    const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
    const [xUsername, setXUsername] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleJoinWaitlist = async () => {
        if (!xUsername) return;
        setIsSubmitting(true);

        const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSddOE2p-2EXAGCeyObMWBJNWZXNd2drZAJ6DiUQlh4-HUBWjg/formResponse';
        const ENTRY_ID = 'entry.1829838795';

        try {
            const formData = new FormData();
            formData.append(ENTRY_ID, xUsername);

            await fetch(GOOGLE_FORM_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });

            // Since no-cors returns opaque response, we assume success if no network error
            alert(`Request logged for ${xUsername}. We will reach out via X DM soon!`);
            window.open("https://x.com/aiboapp", "_blank");
            setIsWaitlistOpen(false);
            setXUsername('');
        } catch (error) {
            console.error('Submission error:', error);
            alert('Something went wrong. Please try again or DM us directly.');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scroll = window.scrollY;
                    const height = window.innerHeight;
                    if (scroll < height * 0.5) setExpression('happy');
                    else if (scroll < height * 1.5) setExpression('thinking');
                    else setExpression('alert');
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const fadeInUp = {
        initial: { opacity: 0, y: 60, scale: 0.98 },
        whileInView: { opacity: 1, y: 0, scale: 1 },
        viewport: { once: true, margin: "-100px" },
        transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] as any }
    };

    const staggerContainer = {
        initial: {},
        whileInView: {
            transition: {
                staggerChildren: 0.15
            }
        }
    };

    const staggerItem = {
        initial: { opacity: 0, y: 30 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }
    };

    const heroRef = useRef(null);
    const { scrollYProgress: heroScroll } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"]
    });
    const heroImgY = useTransform(heroScroll, [0, 1], [0, 300]);
    const heroImgRotate = useTransform(heroScroll, [0, 1], [0, 10]);

    const featuresRef = useRef(null);
    const { scrollYProgress: featuresScroll } = useScroll({
        target: featuresRef,
        offset: ["start end", "end start"]
    });
    const featuresImgY1 = useTransform(featuresScroll, [0, 1], [150, -150]);
    const featuresImgY2 = useTransform(featuresScroll, [0, 1], [250, -250]);

    const showcaseRef = useRef(null);
    const { scrollYProgress: showcaseScroll } = useScroll({
        target: showcaseRef,
        offset: ["start end", "end start"]
    });
    const showcaseImgY = useTransform(showcaseScroll, [0, 1], [150, -150]);
    const showcaseContentScale = useTransform(showcaseScroll, [0, 0.5, 1], [0.95, 1, 0.95]);

    const ctaRef = useRef<HTMLElement>(null);
    const partnersRef = useRef<HTMLElement>(null);
    const { scrollYProgress: ctaScroll } = useScroll({
        target: ctaRef,
        offset: ["start end", "end end"]
    });
    const ctaScale = useTransform(ctaScroll, [0, 1], [0.85, 1]);
    const ctaRotate = useTransform(ctaScroll, [0, 1], [-2, 0]);

    const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
        ref.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="landing-page">
            {/* Waitlist Modal */}
            <AnimatePresence>
                {isWaitlistOpen && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsWaitlistOpen(false)}
                    >
                        <motion.div
                            className="waitlist-modal"
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-title-bar" style={{ justifyContent: 'flex-end', padding: '0.8rem' }}>
                                <div
                                    style={{ width: '12px', height: '12px', background: 'var(--bevel-shadow)', borderRadius: '50%', cursor: 'pointer', opacity: 0.5 }}
                                    onClick={() => setIsWaitlistOpen(false)}
                                ></div>
                            </div>

                            <div className="modal-content">
                                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-active)', marginBottom: '0.5rem' }}>Reserve Your Access</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.4 }}>Provide your X username so we can DM you regarding your access.</p>
                                </div>

                                <div className="social-note">
                                    <div style={{ fontWeight: '800', color: 'var(--text-active)', marginBottom: '4px' }}>Deployment Requirements:</div>
                                    Follow <a href="https://x.com/aiboapp" target="_blank" rel="noopener noreferrer">@aiboapp</a> and ensure your DMs are open. We prioritize active community members.
                                </div>

                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="@username"
                                        className="waitlist-input"
                                        value={xUsername}
                                        onChange={(e) => setXUsername(e.target.value)}
                                        disabled={isSubmitting}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && xUsername) {
                                                handleJoinWaitlist();
                                            }
                                        }}
                                    />
                                </div>

                                <button
                                    className="btn-luna-heavy btn-modal-submit"
                                    onClick={handleJoinWaitlist}
                                    disabled={isSubmitting}
                                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                                >
                                    {isSubmitting ? 'Joining...' : 'Join Waitlist'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            <header className="app-header-sync">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', height: '100%' }}>
                    <img src="/assets/defaultAibo.png" alt="Aibo" style={{ width: '48px', height: 'auto', display: 'block', transform: 'translateY(-3px)' }} />
                    <div className="header-label" style={{ fontWeight: '800', fontSize: '15px', lineHeight: 1, display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
                        <span className="header-main-text">Aibō</span> <span className="header-assistant-text" style={{ opacity: 0.6, fontWeight: '600', marginLeft: '6px' }}>Desktop Assistant</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1.2rem', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>
                        <span style={{ cursor: 'pointer' }} onClick={() => scrollToSection(partnersRef)}>Partners</span>
                        <span className="coming-soon">Documentation</span>
                    </div>
                    <button
                        className="btn-luna-small"
                        onClick={() => setIsWaitlistOpen(true)}
                    >
                        Get<span className="btn-text-extra">&nbsp;Aibō</span>
                    </button>
                </div>
            </header>

            {/* Hero Section - Asymmetrical Bleed with Raw Hardware */}
            <section className="section section-hero" ref={heroRef}>
                <div className="container">
                    <div className="asymmetric-grid">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }}
                        >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '8px 16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', marginBottom: '3rem' }}>
                                <Zap size={16} fill="white" />
                                <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.02em' }}>Available for Mac and Windows</span>
                            </div>

                            <h1 className="section-title text-sharp">
                                The Proper <br />
                                <span style={{ color: 'rgba(255,255,255,0.7)' }}>OS Sidekick.</span>
                            </h1>

                            <p style={{ fontSize: '1.6rem', color: 'rgba(255,255,255,0.9)', maxWidth: '540px', margin: '3rem 0 4rem', lineHeight: 1.3, fontWeight: '500' }}>
                                Aibō is a system-level desktop assistant built for modern workflows. Zero latency market ingestion and local-first risk mitigation.
                            </p>

                            <div className="hero-btn-group">
                                <button className="btn-luna-heavy" onClick={() => setIsWaitlistOpen(true)}>
                                    Download Aibō <Download size={20} />
                                </button>
                                <button className="btn-hardware-ghost" onClick={() => setIsWaitlistOpen(true)}>
                                    Join Waitlist <ArrowRight size={20} />
                                </button>
                            </div>
                        </motion.div>

                        <motion.div
                            className="image-bleed-right"
                            initial={{ opacity: 0, scale: 0.98, x: 100 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] as any }}
                        >
                            <img src="/assets/defaultAngle.webp" alt="Aibo Hardware" className="raw-hardware" style={{ width: '100%' }} />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Statement Breather */}
            <section className="section-statement">
                <div className="container-narrow">
                    <motion.div {...fadeInUp}>
                        <h2 className="text-sharp" style={{ fontSize: '3.5rem', marginBottom: '1.5rem', color: 'var(--text-active)' }}>De-terminalize your workflow.</h2>
                        <p style={{ fontSize: '1.4rem', color: 'var(--text-secondary)' }}>
                            Join the professional elite who have moved beyond terminal jargon into a world of clean, native assistant intelligence.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Features Section - Rhythmic Stacked Raw Hardware */}
            <section className="section section-features" ref={featuresRef}>
                <div className="container">
                    <div className="asymmetric-grid reverse">
                        <div className="image-cluster">
                            <motion.div
                                className="image-stack-base"
                            >
                                <img src="/assets/trackerAngleFinal.webp" alt="Tracker" className="raw-hardware" style={{ width: '100%', display: 'block' }} />
                            </motion.div>
                            <motion.div
                                className="image-overlap"
                            >
                                <img src="/assets/walletAngleFinal.webp" alt="Wallet" className="raw-hardware" style={{ width: '100%', display: 'block' }} />
                            </motion.div>
                        </div>

                        <motion.div {...fadeInUp}>
                            <h2 className="section-title text-sharp" style={{ fontSize: '4.5rem', color: 'var(--text-active)' }}>
                                Market Insight <br />
                                <span style={{ color: 'var(--accent)' }}>Without Borders.</span>
                            </h2>
                            <p style={{ fontSize: '1.4rem', color: 'var(--text-secondary)', marginBottom: '4rem' }}>
                                Aibō monitors thousands of signals across market sentiment and on-chain risk, keeping you informed without the noise.
                            </p>

                            <motion.div
                                style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3rem' }}
                                variants={staggerContainer}
                                initial="initial"
                                whileInView="whileInView"
                                viewport={{ once: true }}
                            >
                                <motion.div style={{ display: 'flex', gap: '2rem' }} variants={staggerItem}>
                                    <div className="panel-raised" style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Lock size={28} color="var(--accent)" />
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: '800', fontSize: '1.3rem' }}>Private Context</h4>
                                        <p style={{ color: 'var(--text-secondary)' }}>Native processing ensures your alpha stays local.</p>
                                    </div>
                                </motion.div>
                                <motion.div style={{ display: 'flex', gap: '2rem' }} variants={staggerItem}>
                                    <div className="panel-raised" style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Cpu size={28} color="var(--accent)" />
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: '800', fontSize: '1.3rem' }}>Local Neural Gear</h4>
                                        <p style={{ color: 'var(--text-secondary)' }}>Instant simulations for every transaction you consider.</p>
                                    </div>
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Showcase Section - Raw Visual Overlap */}
            <section className="section section-showcase" ref={showcaseRef}>
                <div className="container">
                    <div className="asymmetric-grid">
                        <motion.div style={{ scale: showcaseContentScale }}>
                            <h2 className="section-title text-sharp" style={{ fontSize: '4.5rem' }}>Unified <br />Intelligence.</h2>
                            <p style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,0.7)', marginBottom: '4rem' }}>
                                Speak to Aibō directly. From risk audits to cross-chain bridges, he manages the complexity so you can focus on the trade.
                            </p>

                            <div style={{ marginTop: '2rem' }}>
                                <h4 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'white', marginBottom: '1rem' }}>Continuous Monitoring</h4>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.2rem', lineHeight: 1.6 }}>
                                    Aibō stays active in your background, alerting you only when high-impact events occur.
                                </p>
                            </div>
                        </motion.div>

                        <div className="showcase-image-container">
                            <motion.div
                                className="showcase-hardware-capture"
                            >
                                <img src="/assets/callAngle.webp" alt="Communication" className="raw-hardware" style={{ width: '100%', display: 'block' }} />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Become a Partner Section - White Reset */}
            <section className="section section-partners" ref={partnersRef}>
                <div className="container-narrow" style={{ textAlign: 'center' }}>
                    <motion.div {...fadeInUp}>
                        <h2 className="section-title text-sharp" style={{ fontSize: '4rem', marginBottom: '2.5rem', color: 'var(--text-active)' }}>Forge a Partnership.</h2>
                        <p style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', marginBottom: '4rem' }}>
                            We're collaborating with top-tier players in the on-chain space. Connect with us to integrate Aibō's intelligence into your ecosystem.
                        </p>
                        <div className="partners-btn-group">
                            <button
                                className="btn-black"
                                onClick={() => window.open("https://x.com/aiboapp", "_blank")}
                            >
                                DM us on <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </button>
                            <div className="btn-separator">OR</div>
                            <button className="btn-luna-heavy" onClick={() => setIsWaitlistOpen(true)}>
                                Join Waitlist <ArrowRight size={20} />
                            </button>
                        </div>
                    </motion.div>
                </div>
            </section>


            {/* Footer - Final Luna Blue Impact */}
            <footer className="landing-footer">
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="footer-branding" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <img src="/assets/logo.svg" alt="Aibo" style={{ width: '60px', height: 'auto', display: 'block', filter: 'brightness(0) invert(1)', transform: 'translateY(-3px)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <span style={{ fontWeight: '900', fontSize: '1.6rem', color: 'white', fontFamily: 'Outfit', lineHeight: 1.1 }}>Aibō OS</span>
                            <p className="footer-secondary-text" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', margin: 0, marginTop: '4px' }}>YOUR PROFESSIONAL DESKTOP COMPANION</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <div className="footer-socials" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                            <a
                                href="https://x.com/aiboapp"
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'white', opacity: 0.8, transition: 'opacity 0.2s', display: 'flex' }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                            <div
                                className="coming-soon"
                                style={{ color: 'white', opacity: 0.8, cursor: 'pointer', transition: 'opacity 0.2s', display: 'flex' }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42l10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701l0 0l-.362 6.306c.529 0 .763-.242 1.065-.537l2.56-2.483l5.322 3.93c.983.541 1.691.265 1.936-.906l3.504-16.51c.358-1.432-.544-2.079-1.636-1.586z" />
                                </svg>
                            </div>
                        </div>
                        <p className="copyright-text" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', fontWeight: '600', margin: 0 }}>© 2026 Aibō OS.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

/**
 * Ad Corrector - Actionable Insights Module
 * SUPER-SCRAPER VERSION (Input + Text)
 */

const GEMINI_API_KEY = window.GEMINI_API_KEY;

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const closeBtn = document.getElementById('ac-modal-close');
    const backdrop = document.getElementById('ac-modal-backdrop');
    const loader = document.getElementById('ac-loader');
    const resultsContainer = document.getElementById('ac-results');

    if (!triggerBtn || !modal) return;

    // Helper to grab data from either a div OR an input box
    const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return el.value || el.innerText || null;
    };

    const openModal = () => {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; 
    };

    const closeModal = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = ''; 
    };

    triggerBtn.addEventListener('click', () => {
        openModal();
        generateInsights();
    });

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    async function generateInsights() {
        loader.style.display = 'flex';
        resultsContainer.innerHTML = '';

        try {
            // THE SUPER-SCRAPE
            // We check the specific IDs used in your Browser Color JS
            const adData = {
                clutter: getVal('ac-clutterPercent'),
                headline: getVal('ac-headlineText'),
                cta: getVal('ac-ctaText'),
                body: getVal('ac-bodyText')
            };

            // Validation: If clutter is missing or 0, the tool hasn't run yet
            if (!adData.clutter || adData.clutter === "0%" || adData.clutter === "0") {
                throw new Error("Please upload an image and wait for the Ad Corrector analysis to finish (the Clutter Score must be visible).");
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an elite OOH strategist. Analyze this data:
                            - Clutter: ${adData.clutter}
                            - Headline: ${adData.headline}
                            - CTA: ${adData.cta}
                            - Body: ${adData.body}
                            
                            Provide a "Fix-It Brief" with 3 sections:
                            1. Speed-View Analysis
                            2. Messaging Hierarchy
                            3. Top 3 Design Fixes.
                            Format in clean HTML with <h3> headers and bullets. No intro/outro.` 
                        }]
                    }]
                })
            });

            const data = await response.json();
            let htmlContent = data.candidates[0].content.parts[0].text;
            htmlContent = htmlContent.replace(/```html|```/g, '');
            
            resultsContainer.innerHTML = htmlContent;

        } catch (error) {
            resultsContainer.innerHTML = `
                <div style="padding: 20px; color: #be123c; background: #fff1f2; border-radius: 8px; border: 1px solid #fda4af;">
                    <h3 style="margin-top:0">Analysis Required</h3>
                    <p>${error.message}</p>
                </div>`;
        } finally {
            loader.style.display = 'none';
        }
    }
};

setTimeout(initAI, 500);

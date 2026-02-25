/**
 * Ad Corrector - Actionable Insights Module
 * UI SCRAPER VERSION - No changes required to main tool
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
            /**
             * THE UI SCRAPE: We pull data directly from the HTML elements 
             * that your main tool populates on the screen.
             */
            const adData = {
                clutter: document.getElementById('ac-clutterPercent')?.innerText || "Not calculated",
                headline: document.getElementById('ac-headlineText')?.innerText || "No headline found",
                cta: document.getElementById('ac-ctaText')?.innerText || "No CTA found",
                colors: document.getElementById('ac-colorPalette')?.innerText || "Not analyzed"
            };

            // Check if we actually have data before sending to AI
            if (adData.clutter === "Not calculated" || adData.clutter === "0%") {
                throw new Error("Please upload an image and wait for the Ad Corrector analysis to finish first.");
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an elite Out-of-Home (OOH) advertising strategist. 
                            Analyze this data from an ad visibility tool:
                            - Clutter Score: ${adData.clutter}
                            - Headline Detected: ${adData.headline}
                            - CTA Detected: ${adData.cta}
                            - Color Palette: ${adData.colors}
                            
                            Provide a "Fix-It Brief" with 3 sections:
                            1. Speed-View Analysis (Is it too cluttered for 3 seconds?)
                            2. Messaging Hierarchy (Is the CTA or Headline clear?)
                            3. Top 3 Design Fixes.
                            Format in clean HTML with <h3> headers and bullet points. No intro or outro.` 
                        }]
                    }]
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            let htmlContent = data.candidates[0].content.parts[0].text;
            htmlContent = htmlContent.replace(/```html|```/g, '');
            
            resultsContainer.innerHTML = htmlContent;

        } catch (error) {
            resultsContainer.innerHTML = `
                <div style="padding: 20px; color: #be123c; background: #fff1f2; border-radius: 8px; border: 1px solid #fda4af;">
                    <h3 style="margin-top:0">Analysis Data Needed</h3>
                    <p>${error.message}</p>
                </div>`;
            console.error('AI Brief Error:', error);
        } finally {
            loader.style.display = 'none';
        }
    }
};

setTimeout(initAI, 500);

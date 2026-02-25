/**
 * Ad Corrector - Actionable Insights Module
 * UNIVERSAL SCRAPER - Accessibility & Data Fixed
 */

const GEMINI_API_KEY = window.GEMINI_API_KEY;

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const loader = document.getElementById('ac-loader');
    const resultsContainer = document.getElementById('ac-results');

    if (!triggerBtn || !modal) return;

    const openModal = () => {
        modal.classList.add('is-open');
        modal.removeAttribute('aria-hidden'); // Fixes the Aria warning
        document.body.style.overflow = 'hidden'; 
    };

    const closeModal = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true'); // Correctly hides it again
        document.body.style.overflow = ''; 
    };

    document.getElementById('ac-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('ac-modal-backdrop')?.addEventListener('click', closeModal);

    triggerBtn.addEventListener('click', () => {
        openModal();
        generateInsights();
    });

    async function generateInsights() {
        loader.style.display = 'flex';
        resultsContainer.innerHTML = '';

        try {
            // THE AGGRESSIVE SCRAPE
            // We look for the clutter score in every possible spot your tool might put it
            const clutterEl = document.querySelector('.ac-clutter-value') || 
                              document.getElementById('ac-clutterPercent') || 
                              Array.from(document.querySelectorAll('span')).find(el => el.textContent.includes('%'));

            const adData = {
                clutter: clutterEl?.innerText || "0%",
                headline: document.getElementById('ac-headlineText')?.value || "Not entered",
                cta: document.getElementById('ac-ctaText')?.value || "Not entered",
                body: document.getElementById('ac-bodyText')?.value || "Not entered"
            };

            // If we still find 0%, the user probably hasn't run the tool yet
            if (adData.clutter === "0%" || adData.clutter === "0") {
                throw new Error("No analysis data detected. Please upload an image and let the tool calculate the Clutter Score first.");
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an elite OOH strategist. Using this data:
                            Clutter: ${adData.clutter}, Headline: ${adData.headline}, CTA: ${adData.cta}.
                            
                            Write a brief with 3 HTML sections (<h3>):
                            1. Speed-View Analysis
                            2. Design Hierarchy
                            3. Top 3 Fixes.
                            Keep it punchy and professional.` 
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
                <div style="padding: 20px; color: #be123c; background: #fff1f2; border-radius: 8px;">
                    <h3 style="margin-top:0">Awaiting Analysis</h3>
                    <p>${error.message}</p>
                </div>`;
        } finally {
            loader.style.display = 'none';
        }
    }
};

setTimeout(initAI, 1000); // 1-second delay to ensure Tilda is fully ready

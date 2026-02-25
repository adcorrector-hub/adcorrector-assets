/**
 * Ad Corrector - Actionable Insights Module
 * DATA-MATCH VERSION (Matched to ADC 2.23.26)
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
        document.body.style.overflow = 'hidden'; 
    };

    const closeModal = () => {
        modal.classList.remove('is-open');
        document.body.style.overflow = ''; 
    };

    // Close listeners
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
            /** * MATCHING YOUR MAIN TOOL'S NAMES:
             * Based on your ADC 2.23.26 file, we pull from these specific spots:
             */
            const adData = {
                // Your tool uses the class 'ac-clutter-value' for the percentage
                clutter: document.querySelector('.ac-clutter-value')?.innerText || "0%",
                // Your tool uses these specific IDs for text inputs
                headline: document.getElementById('ac-headlineText')?.value || "None detected",
                cta: document.getElementById('ac-ctaText')?.value || "None detected",
                body: document.getElementById('ac-bodyText')?.value || "None detected"
            };

            // If the clutter is still 0%, it means the tool hasn't been run
            if (adData.clutter === "0%" || adData.clutter === "0") {
                throw new Error("Analysis not detected. Please upload an ad and wait for the 'Clutter Score' to appear on the dashboard first.");
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an elite OOH strategist. Create a 'Fix-It Brief' for an ad with:
                            Clutter: ${adData.clutter}
                            Headline: ${adData.headline}
                            CTA: ${adData.cta}
                            Body: ${adData.body}
                            
                            Format with <h3> headers:
                            1. Speed-View Analysis
                            2. Design Hierarchy
                            3. Top 3 Fixes.
                            Use clean HTML/bullets. No intro/outro text.` 
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
                <div style="padding: 20px; color: #be123c; background: #fff1f2; border-radius: 8px;">
                    <h3 style="margin-top:0">Data Not Found</h3>
                    <p>${error.message}</p>
                </div>`;
        } finally {
            loader.style.display = 'none';
        }
    }
};

setTimeout(initAI, 800);

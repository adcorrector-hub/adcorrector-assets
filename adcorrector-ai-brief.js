/**
 * Ad Corrector - Actionable Insights Module
 * RESILIENT VERSION - Auto-Retry Logic + Aria Fix
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
        modal.removeAttribute('aria-hidden'); 
        document.body.style.overflow = 'hidden'; 
    };

    const closeModal = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
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
            // Function to find the clutter score anywhere on the page
            const findClutter = () => {
                const specificClass = document.querySelector('.ac-clutter-value');
                if (specificClass && specificClass.innerText !== "0%") return specificClass.innerText;
                
                // Backup: find any span that looks like a percentage but isn't 0%
                const allSpans = Array.from(document.querySelectorAll('span'));
                const percentSpan = allSpans.find(s => s.innerText.includes('%') && s.innerText !== "0%");
                return percentSpan ? percentSpan.innerText : null;
            };

            const clutterValue = findClutter();

            if (!clutterValue || clutterValue === "0%") {
                throw new Error("No analysis detected. Please upload an image and let the Clutter Score calculate first.");
            }

            const adData = {
                clutter: clutterValue,
                headline: document.getElementById('ac-headlineText')?.value || "N/A",
                cta: document.getElementById('ac-ctaText')?.value || "N/A"
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an OOH expert. Analyze this: Clutter ${adData.clutter}, Headline: ${adData.headline}, CTA: ${adData.cta}. 
                            Create a Fix-It Brief with <h3> sections: 
                            1. Analysis, 2. Design Fixes. 
                            Use HTML format.` 
                        }]
                    }]
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            resultsContainer.innerHTML = data.candidates[0].content.parts[0].text.replace(/```html|```/g, '');

        } catch (error) {
            resultsContainer.innerHTML = `
                <div style="padding: 20px; color: #be123c; background: #fff1f2; border-radius: 8px;">
                    <h3 style="margin-top:0">Awaiting Results</h3>
                    <p>${error.message}</p>
                </div>`;
        } finally {
            loader.style.display = 'none';
        }
    }
};

// Use multiple triggers to ensure it wakes up in Tilda
setTimeout(initAI, 500);
setTimeout(initAI, 2000);

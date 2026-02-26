/**
 * Ad Corrector - AI Brief
 * VERSION: SEARCH & RESCUE (Final Sync)
 */

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const resultsContainer = document.getElementById('ac-results');
    const loader = document.getElementById('ac-loader');

    if (!triggerBtn || !modal) return;

    triggerBtn.onclick = async function() {
        modal.style.display = 'flex';
        modal.classList.add('is-open');
        loader.style.display = 'block';
        resultsContainer.innerHTML = '';

        const apiKey = window.GEMINI_API_KEY;

        // 1. DATA SCRAPE (Search & Rescue Mode)
        // We scan the whole page for a percentage or a score
        const getScore = () => {
            const pageText = document.body.innerText;
            const match = pageText.match(/(\d+)%/); // Looks for any number followed by %
            return match ? match[0] : "65%"; // Defaults to 65% if it can't find it
        };

        const score = getScore();
        const headline = document.getElementById('ac-headlineText')?.value || "None";
        const cta = document.getElementById('ac-ctaText')?.value || "None";

        try {
            // 2. THE API CALL (Using the stable v1 path)
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an OOH creative expert. Analyze this ad result:
                            Speed-View Score: ${score}
                            Headline: "${headline}"
                            CTA: "${cta}"
                            
                            Generate a 'Fix-It Brief' in HTML with <h3> headers:
                            1. Visibility Analysis
                            2. 3 Specific Design Fixes.
                            Keep it professional and actionable.` 
                        }]
                    }]
                })
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            // 3. RENDER
            loader.style.display = 'none';
            let content = data.candidates[0].content.parts[0].text;
            resultsContainer.innerHTML = content.replace(/```html|```/g, '');

        } catch (err) {
            loader.style.display = 'none';
            resultsContainer.innerHTML = `<div style="color:#991b1b; background:#fef2f2; padding:15px; border-radius:8px;"><strong>Status:</strong> ${err.message}</div>`;
        }
    };

    const closeModal = () => { modal.style.display = 'none'; };
    document.getElementById('ac-modal-close').onclick = closeModal;
    document.getElementById('ac-modal-backdrop').onclick = closeModal;
};

setTimeout(initAI, 1000);

/**
 * Ad Corrector - AI Brief
 * VERSION: THE SMOKE TEST (Proof of Life)
 */

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const resultsContainer = document.getElementById('ac-results');
    const loader = document.getElementById('ac-loader');

    if (!triggerBtn || !modal) return;

    triggerBtn.onclick = async function() {
        // 1. Force the window open immediately
        modal.style.display = 'flex';
        modal.classList.add('is-open');
        loader.style.display = 'block';
        resultsContainer.innerHTML = '';

        const apiKey = window.GEMINI_API_KEY;

        // 2. Simple Scrape (Headline only for the test)
        const headline = document.getElementById('ac-headlineText')?.value || "Test Ad";
        
        try {
            // 3. The most basic API call possible
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Give me 3 quick OOH design tips for an ad with the headline: "${headline}". Format in simple HTML bullets.` 
                        }]
                    }]
                })
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            // 4. Show the result
            loader.style.display = 'none';
            let content = data.candidates[0].content.parts[0].text;
            resultsContainer.innerHTML = content.replace(/```html|```/g, '');

        } catch (err) {
            loader.style.display = 'none';
            resultsContainer.innerHTML = `<div style="color:#991b1b; background:#fef2f2; padding:15px; border-radius:8px;"><strong>Test Failed:</strong> ${err.message}</div>`;
        }
    };

    // Close Button Logic
    const closeModal = () => { modal.style.display = 'none'; };
    document.getElementById('ac-modal-close').onclick = closeModal;
    document.getElementById('ac-modal-backdrop').onclick = closeModal;
};

// Start it up
setTimeout(initAI, 1000);

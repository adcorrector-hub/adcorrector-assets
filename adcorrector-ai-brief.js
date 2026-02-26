const GEMINI_API_KEY = window.GEMINI_API_KEY;

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const resultsContainer = document.getElementById('ac-results');
    const loader = document.getElementById('ac-loader');

    if (!triggerBtn || !modal) return;

    triggerBtn.onclick = async function() {
        // 1. Open the modal (The part that worked!)
        modal.classList.add('is-open');
        modal.style.display = 'flex';
        loader.style.display = 'block';
        resultsContainer.innerHTML = '';

        try {
            // 2. THE REAL HANDSHAKE
            // Instead of "3.2s", we grab the actual % from your screen
            const realClutter = document.querySelector('.ac-clutter-value')?.innerText || "0%";
            const realHeadline = document.getElementById('ac-headlineText')?.value || "None detected";
            const realCTA = document.getElementById('ac-ctaText')?.value || "None detected";

            // 3. SEND TO AI
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an OOH expert. Analyze this specific ad data: 
                            - Clutter/Speed-View: ${realClutter}
                            - Headline: ${realHeadline}
                            - CTA: ${realCTA}
                            
                            Provide a brief "Fix-It Plan" in HTML with <h3> headers for:
                            1. Visibility Analysis
                            2. Design Recommendations.` 
                        }]
                    }]
                })
            });

            const data = await response.json();
            loader.style.display = 'none';
            
            // Show the real AI response
            resultsContainer.innerHTML = data.candidates[0].content.parts[0].text.replace(/```html|```/g, '');

        } catch (error) {
            loader.style.display = 'none';
            resultsContainer.innerHTML = "Something went wrong. Make sure your API key is correct.";
        }
    };

    // Close Button logic
    document.getElementById('ac-modal-close').onclick = () => { modal.style.display = 'none'; };
};

setTimeout(initAI, 1000);

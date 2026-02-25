/**
 * Ad Corrector - Actionable Insights Module
 * Fixed for Tilda Deployment
 */

// 1. Grab the key from the Tilda window
const GEMINI_API_KEY = window.GEMINI_API_KEY;

// 2. Wrap everything in a function so the 'return' is legal
const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const closeBtn = document.getElementById('ac-modal-close');
    const backdrop = document.getElementById('ac-modal-backdrop');
    const loader = document.getElementById('ac-loader');
    const resultsContainer = document.getElementById('ac-results');

    // This 'return' is now legal because it is inside a function!
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
            // This is a placeholder for your tool's actual physics data
          // Grab the ACTUAL results from your main Ad Corrector engine
    // (Adjust these variable names if your main tool uses different ones)
    const adData = {
        speedView: window.currentSpeedView || "Not calculated",
        clutterScore: window.currentClutterScore || "Not calculated",
        legibility: window.currentLegibilityScore || "Not calculated",
        fontThickness: window.currentFontWeight || "Standard"
    };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: text: `Act as an elite Out-of-Home (OOH) advertising strategist. 
Analyze this specific ad physics data: ${JSON.stringify(adData)}. 
Provide a "Fix-It Brief" with 3 clear sections: 
1. Speed-View Analysis 
2. Heatmap/Clutter Insight 
3. Top 3 Design Fixes. 
Format the response in clean HTML with <h3> headers.` }]
                    }]
                })
            });

            const data = await response.json();
            resultsContainer.innerHTML = data.candidates[0].content.parts[0].text.replace(/```html|```/g, '');
        } catch (error) {
            resultsContainer.innerHTML = "<p>Error generating brief. Check API key restrictions.</p>";
            console.error(error);
        } finally {
            loader.style.display = 'none';
        }
    }
};

// 3. Run the function after a 500ms delay to make sure Tilda is ready
setTimeout(initAI, 500);


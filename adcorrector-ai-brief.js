/**
 * Ad Corrector - Actionable Insights Module
 * Standalone vanilla JS component intended to be hosted on GitHub/jsDelivr
 */
const GEMINI_API_KEY = 'AIzaSyA2urgEfFz-kSDr2ErfQ1HCo8BQgqnbV7M';
document.addEventListener('DOMContentLoaded', () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const closeBtn = document.getElementById('ac-modal-close');
    const backdrop = document.getElementById('ac-modal-backdrop');
    const loader = document.getElementById('ac-loader');
    const resultsContainer = document.getElementById('ac-results');
    if (!triggerBtn || !modal) return;
    // --- Modal State Management ---
    const openModal = () => {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    };
    const closeModal = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = ''; // Restore scrolling
    };
    // --- Event Listeners ---
    triggerBtn.addEventListener('click', () => {
        openModal();
        generateInsights();
    });
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) {
            closeModal();
        }
    });
    // --- Mock Ad Corrector Data Gathering ---
    const gatherMockPhysicsData = () => {
        return {
            timestamp: new Date().toISOString(),
            metrics: {
                speedViewScore: 42, // Indicates suboptimal legibility speed
                fontMetrics: {
                    thickness: 'Ultra-Light',
                    kerning: '-0.05em (Too tight)',
                    legibilityIndex: 0.38
                },
                heatmapData: {
                    clutterScore: 85, // High clutter leading to high cognitive load
                    primaryFocalPoints: 7, // Too many focal points dispersing visual energy
                    cognitiveLoad: 'Very High'
                },
                contrastRatio: 3.2 // Failing WCAG AAA
            }
        };
    };
    // --- Gemini API Integration ---
    const generateInsights = async () => {
        // Reveal Loader, Hide Results
        loader.style.display = 'flex';
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
        const physicsData = gatherMockPhysicsData();
        // Base64 representation of a tiny 1x1 transparent placeholder ad image
        const placeholderImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        // The Critical System Prompt
        const systemPrompt = `
You are an elite Out-of-Home (OOH) advertising strategist. Your task is to translate raw JSON physics data from an ad design into a beginner-friendly, real-world action plan.
You must absolutely avoid definitive words like "guarantee," "ensure," "prove," or "will succeed." Provide guidance based entirely on deterministic physics and visibility metrics.
Structure your output ENTIRELY as raw HTML (no markdown wrappers like \`\`\`html, just the raw HTML tags).
Use exactly this structure for your response, populating the brackets with your insights:
<div class="ac-results-section">
  <h3>Speed-View Analysis</h3>
  <p>[Explain font thinness, kerning, and legibility based only on the data]</p>
</div>
<div class="ac-results-section">
  <h3>Heatmap & Cognitive Load</h3>
  <p>[Explain the clutter and why it requires high cognitive energy]</p>
</div>
<div class="ac-results-section">
  <h3>Real-World Action Plan</h3>
  <ul>
    <li>[Actionable design fix 1]</li>
    <li>[Actionable design fix 2]</li>
    <li>[Actionable design fix 3]</li>
  </ul>
</div>
    `.trim();
        try {
            if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
                throw new Error('API Key is missing. Please replace GEMINI_API_KEY with your actual Google Gemini API key.');
            }
            // We use the gemini-3.1-pro model as explicitly requested. 
            // Ensure the endpoint model string matches standard Google API formatting.
            const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro:generateContent?key=\${GEMINI_API_KEY}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [{
            parts: [
              {
                text: "Here is the raw JSON physics data:\\n" + JSON.stringify(physicsData, null, 2)
              },
              {
                inline_data: {
                  mime_type: "image/png",
                  data: placeholderImageBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2 // Low temperature for deterministic, analytical insights
          }
        })
      });
      if (!response.ok) {
        const errDetails = await response.text();
        throw new Error(\`API request failed: \${response.status} \${errDetails}\`);
      }
      const data = await response.json();
      const aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (aiResponseText) {
        // Fallback cleanup: stripping markdown if the AI accidentally ignores the strict HTML prompt
        const cleanHTML = aiResponseText.replace(/\\`\\`\\`html / g, '').replace(/\\`\\`\\`/g, '').trim();
            resultsContainer.innerHTML = cleanHTML;
        } else {
            throw new Error('Unexpected response structure from Gemini API. Content missing.');
        }
    } catch (error) {
        console.error('Ad Corrector AI Insights Error:', error);
        resultsContainer.innerHTML = \`
        <div class="ac-results-section" style="border-left: 4px solid #e11d48; background: #fff1f2;">
          <h3 style="color: #be123c;">Insights Synthesis Failed</h3>
          <p style="color: #9f1239; font-weight: 500;">\${error.message}</p>
          <p style="font-size: 13px; color: #9f1239; margin-top: 10px;">Check browser console for more details.</p>
        </div>
      \`;
    } finally {
      // Hide loader, reveal results
      loader.style.display = 'none';
      resultsContainer.style.display = 'block';
    }
  };
});
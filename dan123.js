    function acTrackUsage(eventName, eventData) {
        if (typeof gtag === 'undefined') return;
        try {
            var safeData = eventData || {};
            safeData.event_category = 'Tool Usage';
            gtag('event', eventName, safeData);
        } catch (e) {
            console.warn('Usage event unavailable:', e);
        }
    }

    var AdCorrector = (function() {
        var uploadedImage = null;
        var currentTool = null;
        var analysisData = {};
        var MAX_FILE_SIZE = 10 * 1024 * 1024;
        var ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        var MAX_IMAGE_DIMENSION = 4000;
        var MAX_SAVED_TESTS = 5;

        function announceToScreenReader(message) {
            var announcer = document.getElementById('ac-sr-announcements');
            if (announcer) {
                announcer.textContent = message;
                setTimeout(function() {
                    announcer.textContent = '';
                }, 1000);
            }
        }

        function sanitizeText(text) {
            if (!text) return '';
            var div = document.createElement('div');
            div.textContent = text;
            return div.textContent.substring(0, 1000);
        }

        function validateFile(file) {
            if (!file) {
                return { valid: false, error: 'No file selected' };
            }
            if (file.size > MAX_FILE_SIZE) {
                return { 
                    valid: false, 
                    error: 'File size exceeds 10MB limit. Please use a smaller image.' 
                };
            }
            if (ALLOWED_TYPES.indexOf(file.type) === -1) {
                return { 
                    valid: false, 
                    error: 'Invalid file type. Please upload a JPG, PNG, or WebP image.' 
                };
            }
            return { valid: true };
        }

        function resizeImageIfNeeded(img) {
            return new Promise(function(resolve) {
                var maxDim = MAX_IMAGE_DIMENSION;
                if (img.width <= maxDim && img.height <= maxDim) {
                    resolve(img);
                    return;
                }
                var ratio = Math.min(maxDim / img.width, maxDim / img.height);
                var newWidth = Math.floor(img.width * ratio);
                var newHeight = Math.floor(img.height * ratio);
                var canvas = document.createElement('canvas');
canvas.width = newWidth;
canvas.height = newHeight;

var ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0, newWidth, newHeight);
                var resizedImg = new Image();
                resizedImg.onload = function() {
                    console.log('Image resized from ' + img.width + 'x' + img.height + 
                               ' to ' + newWidth + 'x' + newHeight);
                    resolve(resizedImg);
                };
                resizedImg.src = canvas.toDataURL('image/jpeg', 0.9);
            });
        }

        function updateScenarioLabels() {
            var speedRange = document.getElementById('ac-speedRange');
            var distanceRange = document.getElementById('ac-distanceRange');
            var speedVal = document.getElementById('ac-speedRangeVal');
            var distanceVal = document.getElementById('ac-distanceRangeVal');

            if (speedRange && speedVal) speedVal.textContent = speedRange.value + ' mph';
            if (distanceRange && distanceVal) distanceVal.textContent = distanceRange.value + ' ft';
        }

        function syncScenarioControlsFromInputs() {
            var speedInput = document.getElementById('ac-viewingSpeed');
            var distanceInput = document.getElementById('ac-viewingDistance');
            var speedRange = document.getElementById('ac-speedRange');
            var distanceRange = document.getElementById('ac-distanceRange');

            if (speedInput && speedRange && speedInput.value !== '') {
                speedRange.value = Math.min(Math.max(parseInt(speedInput.value, 10) || 65, 5), 90);
            }
            if (distanceInput && distanceRange && distanceInput.value !== '') {
                distanceRange.value = Math.min(Math.max(parseInt(distanceInput.value, 10) || 600, 50), 1500);
            }

            updateScenarioLabels();
        }

        function applyScenarioControls(renderPreview) {
            var speedInput = document.getElementById('ac-viewingSpeed');
            var distanceInput = document.getElementById('ac-viewingDistance');
            var speedRange = document.getElementById('ac-speedRange');
            var distanceRange = document.getElementById('ac-distanceRange');

            if (speedInput && speedRange) speedInput.value = speedRange.value;
            if (distanceInput && distanceRange) distanceInput.value = distanceRange.value;

            updateScenarioLabels();

            if (renderPreview && uploadedImage) {
                renderSpeedView();
            }
        }

        function setViewingPresetState(activeButton) {
            var presetButtons = document.querySelectorAll('.ac-viewing-preset');
            for (var i = 0; i < presetButtons.length; i++) {
                var isActive = presetButtons[i] === activeButton;
                presetButtons[i].classList.toggle('ac-preset-active', isActive);
                presetButtons[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
            }
        }

        function bindViewingPresets() {
            var presetButtons = document.querySelectorAll('.ac-viewing-preset');
            var speedInput = document.getElementById('ac-viewingSpeed');
            var distanceInput = document.getElementById('ac-viewingDistance');

            for (var i = 0; i < presetButtons.length; i++) {
                presetButtons[i].addEventListener('click', function() {
                    if (!speedInput || !distanceInput) return;

                    speedInput.value = this.getAttribute('data-speed') || speedInput.value;
                    distanceInput.value = this.getAttribute('data-distance') || distanceInput.value;
                    setViewingPresetState(this);
                    syncScenarioControlsFromInputs();
                    acTrackUsage('viewing_preset_selected', {
                        preset: this.getAttribute('data-ac-preset') || 'unknown'
                    });
                    announceToScreenReader((this.getAttribute('data-ac-preset') || 'Viewing') + ' starting point applied.');
                });
            }

            function clearPresetState() {
                setViewingPresetState(null);
            }

            if (speedInput) speedInput.addEventListener('input', clearPresetState);
            if (distanceInput) distanceInput.addEventListener('input', clearPresetState);
        }

        function bindScenarioSimulator() {
            var speedRange = document.getElementById('ac-speedRange');
            var distanceRange = document.getElementById('ac-distanceRange');
            var rerunBtn = document.getElementById('ac-rerunScenarioBtn');
            var speedInput = document.getElementById('ac-viewingSpeed');
            var distanceInput = document.getElementById('ac-viewingDistance');

            if (!speedRange || !distanceRange) return;

            speedRange.addEventListener('input', function() {
                applyScenarioControls(true);
            });

            distanceRange.addEventListener('input', function() {
                applyScenarioControls(true);
            });

            if (rerunBtn) {
                rerunBtn.addEventListener('click', function() {
                    applyScenarioControls(false);
                    if (uploadedImage) {
                        acTrackUsage('scenario_rerun');
                        analyzeAd();
                    }
                });
            }

            if (speedInput) {
                speedInput.addEventListener('input', syncScenarioControlsFromInputs);
            }
            if (distanceInput) {
                distanceInput.addEventListener('input', syncScenarioControlsFromInputs);
            }

            syncScenarioControlsFromInputs();
        }

        function bindCompareButtons() {
            window.acCompareSlots = window.acCompareSlots || { a: null, b: null };

            var saveA = document.getElementById('ac-saveVersionA');
            var saveB = document.getElementById('ac-saveVersionB');
            var clear = document.getElementById('ac-clearCompare');

            if (saveA) {
                saveA.addEventListener('click', function() {
                    acSaveCompareSlot('a');
                });
            }

            if (saveB) {
                saveB.addEventListener('click', function() {
                    acSaveCompareSlot('b');
                });
            }

            if (clear) {
                clear.addEventListener('click', function() {
                    window.acCompareSlots = { a: null, b: null };
                    displayComparePanel();
                    announceToScreenReader('Version comparison cleared.');
                });
            }

            displayComparePanel();
        }

        function init() {
            try {
                var uploadSection = document.getElementById('ac-uploadSection');
                var fileInput = document.getElementById('ac-fileInput');
                var boardType = document.getElementById('ac-boardType');
		if (!uploadSection || !fileInput || !boardType) {
  console.error('Ad Corrector init aborted: missing required DOM nodes.', {
    uploadSection: !!uploadSection,
    fileInput: !!fileInput,
    boardType: !!boardType
  });
  return;
}

                if (!window.FileReader) {
                    console.error('FileReader API not supported');
                    alert('Your browser does not support file uploads. Please use a modern browser.');
                    return;
                }

                uploadSection.addEventListener('click', function() {
                    fileInput.click();
                });

                uploadSection.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    uploadSection.classList.add('dragover');
                });

                uploadSection.addEventListener('dragleave', function() {
                    uploadSection.classList.remove('dragover');
                });

                uploadSection.addEventListener('drop', function(e) {
                    e.preventDefault();
                    uploadSection.classList.remove('dragover');
                    var file = e.dataTransfer.files[0];
                    if (file && file.type && file.type.indexOf('image/') === 0) {
                        handleFileUpload(file);
                    } else {
                        alert('Please drop an image file (JPG, PNG, or WebP)');
                    }
                });

                fileInput.addEventListener('change', function(e) {
                    var file = e.target.files[0];
                    if (file) {
                        handleFileUpload(file);
                    }
                });

                boardType.addEventListener('change', function(e) {
                    var customSizeGroup = document.getElementById('ac-customSizeGroup');
                    var speedInput = document.getElementById('ac-viewingSpeed');
                    var distanceInput = document.getElementById('ac-viewingDistance');
                    
                    switch(e.target.value) {
                        case 'bulletin':
                            speedInput.value = 65;
                            distanceInput.value = 600;
                            customSizeGroup.style.display = 'none';
                            break;
                        case 'poster':
                            speedInput.value = 45;
                            distanceInput.value = 300;
                            customSizeGroup.style.display = 'none';
                            break;
                        case 'street':
                            speedInput.value = 25;
                            distanceInput.value = 100;
                            customSizeGroup.style.display = 'none';
                            break;
                        case 'custom':
                            speedInput.value = 55;
                            distanceInput.value = 500;
                            customSizeGroup.style.display = 'flex';
                            break;
                    }
                    syncScenarioControlsFromInputs();
                    setViewingPresetState(null);
                });
                
                var headlineInput = document.getElementById('ac-headlineText');
                var ctaInput = document.getElementById('ac-ctaText');
                var bodyInput = document.getElementById('ac-bodyText');
                
               function updateWordCount() {
    var isBrandMode = (window.acScoringMode === 'brand');
    var headlineWords = headlineInput.value.trim()
        ? headlineInput.value.trim().split(/\s+/).length : 0;
    var ctaWords = !isBrandMode && ctaInput.value.trim()
        ? ctaInput.value.trim().split(/\s+/).length : 0;
    var bodyWords = bodyInput.value.trim()
        ? bodyInput.value.trim().split(/\s+/).length : 0;

    var totalWords = headlineWords + ctaWords + bodyWords;
    var hasDeclaredText = totalWords > 0;  // user-provided (headline/cta/body) text exists

    document.getElementById('ac-headlineCount').textContent = headlineWords;
    document.getElementById('ac-ctaCount').textContent = ctaWords;
    document.getElementById('ac-bodyCount').textContent = bodyWords;
    document.getElementById('ac-totalCount').textContent = totalWords;

    var wordCountDisplay = document.getElementById('ac-wordCountDisplay');
    var adviceEl = document.getElementById('ac-wordAdvice');

    if (totalWords > 0) {
        wordCountDisplay.style.display = 'block';

        // -------------------------------
        // FORMAT-AWARE WORD LIMITS
        // -------------------------------
        var boardTypeEl = document.getElementById('ac-boardType');
        var boardType = boardTypeEl ? boardTypeEl.value : 'bulletin';

        // Default = bulletin (highway)
        var idealLimit = 7;
        var warnLimit  = 12;

        // Poster (12' x 24')
        if (boardType === 'poster') {
            idealLimit = 10;
            warnLimit  = 18;
        }
        // Street furniture / transit shelter (5' x 11')
        else if (boardType === 'street') {
            idealLimit = 12;
            warnLimit  = 20;
        }
        // Custom stays on bulletin defaults for now

        // -------------------------------
        // DETERMINE ADVICE MESSAGE
        // -------------------------------
        var msg = '';
        var color = '#2389ff';

        if (totalWords <= idealLimit) {
            msg = 'Ideal: this format performs best with concise copy of ' + idealLimit + ' words or fewer.';
            color = '#2b8a3e'; // green
        } else if (totalWords <= warnLimit) {
            msg = 'Borderline: this amount of copy may be harder to read quickly for this format.';
            color = '#ffc107'; // yellow
        } else {
            msg = 'Too much copy for this OOH format. Aim for around ' + idealLimit + ' words.';
            color = '#ff6b6b'; // red
        }

        adviceEl.textContent = msg;
        adviceEl.style.color = color;
    } else {
        wordCountDisplay.style.display = 'none';
        adviceEl.textContent = '';
    }
}
                
                headlineInput.addEventListener('input', updateWordCount);
                ctaInput.addEventListener('input', updateWordCount);
                bodyInput.addEventListener('input', updateWordCount);
                window.acRefreshWordCount = updateWordCount;
		updateWordCount();
                bindScenarioSimulator();
                bindViewingPresets();
                bindCompareButtons();
                bindCopySummaryButton();
                bindSavedTests();

                console.log('Ad Corrector initialized successfully');
            } catch (error) {
                console.error('Initialization error:', error);
                alert('Error initializing tool. Please refresh the page.');
            }
        }

        function getCurrentFormInputs() {
            var boardType = document.getElementById('ac-boardType');
            var boardLabel = boardType && boardType.options[boardType.selectedIndex]
                ? boardType.options[boardType.selectedIndex].text
                : 'Billboard';

            return {
                boardType: boardType ? boardType.value : 'bulletin',
                boardLabel: boardLabel,
                customHeight: sanitizeText((document.getElementById('ac-customHeight') || {}).value || ''),
                speed: parseInt((document.getElementById('ac-viewingSpeed') || {}).value, 10) || 65,
                distance: parseInt((document.getElementById('ac-viewingDistance') || {}).value, 10) || 600,
                mode: window.acScoringMode || 'direct',
                headline: sanitizeText((document.getElementById('ac-headlineText') || {}).value || ''),
                cta: sanitizeText((document.getElementById('ac-ctaText') || {}).value || ''),
                body: sanitizeText((document.getElementById('ac-bodyText') || {}).value || '')
            };
        }

        function getListText(id, limit) {
            var list = document.getElementById(id);
            if (!list) return [];

            var nodes = list.querySelectorAll('li');
            var items = [];
            for (var i = 0; i < nodes.length && items.length < limit; i++) {
                var text = sanitizeText(nodes[i].textContent || '').trim();
                if (text) items.push(text);
            }
            return items;
        }

        function copyTextToClipboard(text) {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(text);
            }

            return new Promise(function(resolve, reject) {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();

                try {
                    var copied = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    copied ? resolve() : reject(new Error('Copy command was not available.'));
                } catch (error) {
                    document.body.removeChild(textarea);
                    reject(error);
                }
            });
        }

        function buildClientSummary() {
            var details = window.acLastDetails || {};
            var inputs = getCurrentFormInputs();
            var modeLabel = inputs.mode === 'brand' ? 'Brand Awareness' : 'Call to Action Campaign';
            var priorities = getListText('ac-actionPlanList', 3);
            var strengths = getListText('ac-workingList', 2);
            var lines = [
                'Ad Corrector® Directional OOH Review',
                '',
                'Overall result: ' + (details.grade || 'N/A') + ' (' + (Math.round(Number(details.avgScore) || 0)) + '/100)',
                'Campaign goal: ' + modeLabel,
                'Viewing conditions reviewed: ' + inputs.boardLabel + ' | ' + inputs.speed + ' mph | ' + inputs.distance + ' ft',
                ''
            ];

            if (priorities.length) {
                lines.push('Fix First Plan:');
                for (var i = 0; i < priorities.length; i++) {
                    lines.push((i + 1) + '. ' + priorities[i]);
                }
                lines.push('');
            }

            if (strengths.length) {
                lines.push("What's Working:");
                for (var j = 0; j < strengths.length; j++) {
                    lines.push('- ' + strengths[j]);
                }
                lines.push('');
            }

            lines.push('This directional review is based on uploaded artwork, selected viewing conditions, and user-entered copy. It is not legal, accessibility, production, media-owner, or performance certification.');
            return lines.join('\n');
        }

        function bindCopySummaryButton() {
            var button = document.getElementById('ac-copySummary');
            if (!button) return;

            button.addEventListener('click', function() {
                if (!window.acLastDetails || !window.acLastScores) {
                    alert('Run an analysis before copying a client summary.');
                    return;
                }

                copyTextToClipboard(buildClientSummary()).then(function() {
                    acTrackUsage('client_summary_copied');
                    announceToScreenReader('Client summary copied to clipboard.');
                    alert('Client summary copied to clipboard.');
                }).catch(function(error) {
                    console.error('Client summary copy failed:', error);
                    alert('Could not copy the client summary. Check browser permissions and try again.');
                });
            });
        }

        function openSavedTestsDB() {
            return new Promise(function(resolve, reject) {
                if (!window.indexedDB) {
                    reject(new Error('Private saved tests are not supported in this browser.'));
                    return;
                }

                var request = window.indexedDB.open('adcorrector-saved-tests', 1);
                request.onupgradeneeded = function(event) {
                    var db = event.target.result;
                    if (!db.objectStoreNames.contains('tests')) {
                        db.createObjectStore('tests', { keyPath: 'id' });
                    }
                };
                request.onsuccess = function(event) {
                    resolve(event.target.result);
                };
                request.onerror = function() {
                    reject(request.error || new Error('Could not open private saved tests.'));
                };
            });
        }

        function getSavedTests() {
            return openSavedTestsDB().then(function(db) {
                return new Promise(function(resolve, reject) {
                    var request = db.transaction('tests', 'readonly').objectStore('tests').getAll();
                    request.onsuccess = function() {
                        db.close();
                        resolve(request.result || []);
                    };
                    request.onerror = function() {
                        db.close();
                        reject(request.error || new Error('Could not read saved tests.'));
                    };
                });
            });
        }

        function putSavedTest(record) {
            return openSavedTestsDB().then(function(db) {
                return new Promise(function(resolve, reject) {
                    var request = db.transaction('tests', 'readwrite').objectStore('tests').put(record);
                    request.onsuccess = function() {
                        db.close();
                        resolve();
                    };
                    request.onerror = function() {
                        db.close();
                        reject(request.error || new Error('Could not save this test.'));
                    };
                });
            });
        }

        function getSavedTest(id) {
            return openSavedTestsDB().then(function(db) {
                return new Promise(function(resolve, reject) {
                    var request = db.transaction('tests', 'readonly').objectStore('tests').get(id);
                    request.onsuccess = function() {
                        db.close();
                        resolve(request.result || null);
                    };
                    request.onerror = function() {
                        db.close();
                        reject(request.error || new Error('Could not open this saved test.'));
                    };
                });
            });
        }

        function deleteSavedTest(id) {
            return openSavedTestsDB().then(function(db) {
                return new Promise(function(resolve, reject) {
                    var request = db.transaction('tests', 'readwrite').objectStore('tests').delete(id);
                    request.onsuccess = function() {
                        db.close();
                        resolve();
                    };
                    request.onerror = function() {
                        db.close();
                        reject(request.error || new Error('Could not remove this saved test.'));
                    };
                });
            });
        }

        function clearSavedTests() {
            return openSavedTestsDB().then(function(db) {
                return new Promise(function(resolve, reject) {
                    var request = db.transaction('tests', 'readwrite').objectStore('tests').clear();
                    request.onsuccess = function() {
                        db.close();
                        resolve();
                    };
                    request.onerror = function() {
                        db.close();
                        reject(request.error || new Error('Could not clear saved tests.'));
                    };
                });
            });
        }

        function imageToBlob(image) {
            if (!image || !image.src) {
                return Promise.reject(new Error('No artwork is available to save.'));
            }

            return fetch(image.src).then(function(response) {
                if (!response.ok) throw new Error('Artwork could not be prepared for private saving.');
                return response.blob();
            });
        }

        function escapeSavedTestText(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function savedTestTimestamp(value) {
            try {
                return new Date(value).toLocaleString([], {
                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                });
            } catch (e) {
                return 'Saved recently';
            }
        }

        function renderSavedTests() {
            var list = document.getElementById('ac-savedTestsList');
            if (!list) return;

            getSavedTests().then(function(records) {
                records.sort(function(a, b) {
                    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
                });

                if (!records.length) {
                    list.innerHTML = '<p>No tests saved on this device yet.</p>';
                    return;
                }

                var html = '';
                for (var i = 0; i < records.length; i++) {
                    var record = records[i];
                    var score = record.details && record.details.avgScore !== undefined
                        ? Math.round(Number(record.details.avgScore) || 0)
                        : 0;
                    var grade = record.details && record.details.grade ? record.details.grade : 'N/A';
                    var conditions = record.inputs || {};
                    html +=
                        '<div class="ac-saved-test-item">' +
                            '<div>' +
                                '<p class="ac-saved-test-name">' + escapeSavedTestText(record.name) + '</p>' +
                                '<p class="ac-saved-test-meta">' + escapeSavedTestText(grade) + ' / ' + score + ' | ' +
                                    escapeSavedTestText(conditions.speed || 65) + ' mph | ' +
                                    escapeSavedTestText(conditions.distance || 600) + ' ft | ' +
                                    escapeSavedTestText(savedTestTimestamp(record.savedAt)) + '</p>' +
                            '</div>' +
                            '<div class="ac-saved-test-actions">' +
                                '<button class="ac-btn ac-btn-secondary" type="button" data-ac-saved-action="open" data-ac-saved-id="' + escapeSavedTestText(record.id) + '">Open</button>' +
                                '<button class="ac-btn ac-btn-tertiary" type="button" data-ac-saved-action="delete" data-ac-saved-id="' + escapeSavedTestText(record.id) + '">Remove</button>' +
                            '</div>' +
                        '</div>';
                }
                list.innerHTML = html;
            }).catch(function(error) {
                console.warn('Saved tests unavailable:', error);
                list.innerHTML = '<p>Private saved tests are unavailable in this browser.</p>';
            });
        }

        function saveCurrentTest() {
            if (!uploadedImage || !window.acLastDetails || !window.acLastScores) {
                alert('Run an analysis before saving a test.');
                return;
            }

            var nameInput = document.getElementById('ac-saveTestName');
            var requestedName = sanitizeText(nameInput ? nameInput.value.trim() : '');
            var defaultName = 'Saved test ' + new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

            getSavedTests().then(function(records) {
                if (records.length >= MAX_SAVED_TESTS) {
                    alert('Saved Tests is full. Remove an existing test before saving another.');
                    return null;
                }
                return imageToBlob(uploadedImage);
            }).then(function(imageBlob) {
                if (!imageBlob) return null;

                var record = {
                    id: 'ac-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                    name: requestedName || defaultName,
                    savedAt: new Date().toISOString(),
                    imageBlob: imageBlob,
                    inputs: getCurrentFormInputs(),
                    scores: window.acLastScores,
                    details: window.acLastDetails,
                    detectedText: String(window.acDetectedText || ''),
                    reliableDetectedText: String(window.acReliableDetectedText || '')
                };
                return putSavedTest(record);
            }).then(function(saved) {
                if (saved === null) return;
                if (nameInput) nameInput.value = '';
                acTrackUsage('saved_test_saved');
                renderSavedTests();
                announceToScreenReader('Current analysis saved privately on this device.');
            }).catch(function(error) {
                console.error('Saved test error:', error);
                alert('Could not save this test on this device. Check available browser storage and try again.');
            });
        }

        function loadSavedTest(id) {
            if (uploadedImage && !window.confirm('Open this saved test? Your current unsaved analysis will be replaced.')) {
                return;
            }

            getSavedTest(id).then(function(record) {
                if (!record || !record.imageBlob || !record.inputs) {
                    throw new Error('This saved test is incomplete.');
                }

                var inputs = record.inputs;
                var objectUrl = URL.createObjectURL(record.imageBlob);
                var restoredImage = new Image();

                restoredImage.onerror = function() {
                    URL.revokeObjectURL(objectUrl);
                    alert('Could not restore this saved artwork.');
                };

                restoredImage.onload = function() {
                    resizeImageIfNeeded(restoredImage).then(function(processedImage) {
                        URL.revokeObjectURL(objectUrl);
                        uploadedImage = processedImage;
                        analysisData = {};
                        window.acDetectedText = String(record.detectedText || '');
                        window.acReliableDetectedText = String(record.reliableDetectedText || '');
                        window.acLastScores = null;
                        window.acLastAnalysisData = null;
                        window.acLastDetails = null;

                        document.getElementById('ac-boardType').value = inputs.boardType || 'bulletin';
                        document.getElementById('ac-customHeight').value = inputs.customHeight || '';
                        document.getElementById('ac-customSizeGroup').style.display = inputs.boardType === 'custom' ? 'flex' : 'none';
                        document.getElementById('ac-viewingSpeed').value = inputs.speed || 65;
                        document.getElementById('ac-viewingDistance').value = inputs.distance || 600;
                        document.getElementById('ac-headlineText').value = inputs.headline || '';
                        document.getElementById('ac-ctaText').value = inputs.cta || '';
                        document.getElementById('ac-bodyText').value = inputs.body || '';
                        window.acScoringMode = inputs.mode === 'brand' ? 'brand' : 'direct';
                        acApplyModeButtonUI(window.acScoringMode);
                        acApplyCampaignModeUI(window.acScoringMode);
                        setViewingPresetState(null);
                        syncScenarioControlsFromInputs();

                        document.getElementById('ac-uploadSection').style.display = 'none';
                        document.getElementById('ac-resultsSection').style.display = 'none';
                        document.getElementById('ac-formSection').style.display = 'block';
                        document.getElementById('ac-photoWarning').classList.remove('show');
                        if (typeof window.acRefreshWordCount === 'function') window.acRefreshWordCount();

                        acTrackUsage('saved_test_opened');
                        announceToScreenReader('Saved test opened. Re-running the directional review.');
                        analyzeAd();
                    });
                };

                restoredImage.src = objectUrl;
            }).catch(function(error) {
                console.error('Open saved test error:', error);
                alert('Could not open this saved test.');
            });
        }

        function bindSavedTests() {
            var saveButton = document.getElementById('ac-saveCurrentTest');
            var clearButton = document.getElementById('ac-clearSavedTests');
            var list = document.getElementById('ac-savedTestsList');

            if (saveButton) saveButton.addEventListener('click', saveCurrentTest);
            if (clearButton) {
                clearButton.addEventListener('click', function() {
                    if (!window.confirm('Clear every saved test from this browser? This cannot be undone.')) return;
                    clearSavedTests().then(function() {
                        acTrackUsage('saved_tests_cleared');
                        renderSavedTests();
                        announceToScreenReader('Saved tests cleared from this browser.');
                    }).catch(function(error) {
                        console.error('Clear saved tests error:', error);
                        alert('Could not clear saved tests.');
                    });
                });
            }

            if (list) {
                list.addEventListener('click', function(event) {
                    var target = event.target;
                    while (target && target !== list && !target.getAttribute('data-ac-saved-action')) {
                        target = target.parentNode;
                    }
                    if (!target || target === list) return;

                    var action = target.getAttribute('data-ac-saved-action');
                    var id = target.getAttribute('data-ac-saved-id');
                    if (action === 'open') {
                        loadSavedTest(id);
                    } else if (action === 'delete' && window.confirm('Remove this saved test from this browser?')) {
                        deleteSavedTest(id).then(function() {
                            acTrackUsage('saved_test_removed');
                            renderSavedTests();
                            announceToScreenReader('Saved test removed from this browser.');
                        }).catch(function(error) {
                            console.error('Remove saved test error:', error);
                            alert('Could not remove this saved test.');
                        });
                    }
                });
            }

            renderSavedTests();
        }

        function handleFileUpload(file) {
            try {
                var validation = validateFile(file);
                if (!validation.valid) {
                    alert(validation.error);
                    announceToScreenReader(validation.error);
                    return;
                }

                window.acDetectedText = '';
                window.acReliableDetectedText = '';
                analysisData.ocrBoxes = [];
                analysisData.ocrWordBoxes = [];

                announceToScreenReader('File uploaded successfully. Processing image...');

                var reader = new FileReader();
                reader.onerror = function() {
                    alert('Error reading file. Please try again.');
                    announceToScreenReader('Error reading file');
                };
                
                reader.onload = function(e) {
                    uploadedImage = new Image();
                    
                    uploadedImage.onerror = function() {
                        alert('Error loading image. Please ensure the file is a valid image.');
                        announceToScreenReader('Error loading image');
                        uploadedImage = null;
                    };
                    
                    uploadedImage.onload = function() {
                        resizeImageIfNeeded(uploadedImage).then(function(processedImg) {
                            uploadedImage = processedImg;
                            
                            if (typeof gtag !== 'undefined') {
                                gtag('event', 'upload_image', {
                                    'event_category': 'Tool Usage',
                                    'event_label': 'Image Upload Success',
                                    'file_size_kb': Math.round(file.size / 1024)
                                });
                            }
                            
                            document.getElementById('ac-uploadSection').style.display = 'none';
                            document.getElementById('ac-formSection').style.display = 'block';
                            
                            announceToScreenReader('Image loaded. Please fill in the design details form.');
                            
                            detectPhoto(uploadedImage);
                            showOCRProgress();
                            performOCRWithTimeout(uploadedImage);
                        });
                    };
                    uploadedImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('File upload error:', error);
                alert('Error uploading file. Please try again.');
                announceToScreenReader('Error uploading file');
            }
        }
        
        function showOCRProgress() {
            var existingMsg = document.getElementById('ac-ocrStatus');
            if (existingMsg) {
                if (existingMsg.parentNode) existingMsg.parentNode.removeChild(existingMsg);
            }
            
            var statusDiv = document.createElement('div');
            statusDiv.id = 'ac-ocrStatus';
            statusDiv.className = 'ac-ocr-status';
            statusDiv.setAttribute('role', 'status');
            statusDiv.setAttribute('aria-live', 'polite');
            statusDiv.innerHTML = '<div class="ac-ocr-status-content"><strong style="color: #2389ff;">Analyzing text in image...</strong><br><span style="color: #666; font-size: 0.9em;">This will take a few seconds</span></div>';
            
            var formSection = document.getElementById('ac-formSection');
            var photoWarning = document.getElementById('ac-photoWarning');
            formSection.insertBefore(statusDiv, photoWarning);
        }
        
        function updateOCRStatus(status, message, details) {
            var statusDiv = document.getElementById('ac-ocrStatus');
            if (!statusDiv) return;
            
            var color, icon, detailsText;
            
            if (status === 'success') {
                color = '#2b8a3e';
                icon = '&#10003;';
                detailsText = details || 'You can edit the text below if needed';
                announceToScreenReader(message + '. ' + detailsText);
            } else if (status === 'error') {
                color = '#ff6b6b';
                icon = '&#9888;';
                detailsText = details || (window.acScoringMode === 'brand'
                    ? 'Please type your headline manually below'
                    : 'Please type your headline and CTA manually below');
                announceToScreenReader(message + '. ' + detailsText);
            }
            
            statusDiv.innerHTML = '<div class="ac-ocr-status-content"><strong style="color: ' + color + ';">' + icon + ' ' + sanitizeText(message) + '</strong><br><span style="color: #666; font-size: 0.9em;">' + sanitizeText(detailsText) + '</span></div>';
            statusDiv.style.borderLeftColor = color;
            
           if (status === 'success') {
  setTimeout(function () {
    if (!statusDiv) return;

    statusDiv.style.transition = 'opacity 0.5s ease';
    statusDiv.style.opacity = '0';

    setTimeout(function () {
      if (statusDiv && statusDiv.parentNode) {
        statusDiv.parentNode.removeChild(statusDiv);
      }
    }, 500);
  }, 6000);
}
        }
        
        function performOCRWithTimeout(image) {
            var ocrCompleted = false;
            var timeoutDuration = 25000;
            
            var timeout = setTimeout(function() {
                if (!ocrCompleted) {
                    console.warn('OCR timed out after 25 seconds');
                    updateOCRStatus('error', 'Text detection timed out', 'Please enter your text manually');
                }
            }, timeoutDuration);
            
            performOCR(image).then(function(success) {
                ocrCompleted = true;
                clearTimeout(timeout);
                
                if (success) {
                    var headlineVal = document.getElementById('ac-headlineText').value;
                    var ctaVal = window.acScoringMode === 'brand'
                        ? ''
                        : document.getElementById('ac-ctaText').value;
                    var foundWords = (headlineVal + ' ' + ctaVal).trim().split(/\s+/).filter(function(w) { return w; }).length;
                    
                    if (typeof gtag !== 'undefined') {
                        gtag('event', 'ocr_complete', {
                            'event_category': 'Tool Performance',
                            'event_label': 'OCR Success',
                            'words_detected': foundWords
                        });
                    }
                    
                    updateOCRStatus('success', 'Auto-detected ' + foundWords + ' words!', 'Edit below if needed, then click Analyze');
                } else {
                    if (typeof gtag !== 'undefined') {
                        gtag('event', 'ocr_complete', {
                            'event_category': 'Tool Performance',
                            'event_label': 'OCR Failed',
                            'words_detected': 0
                        });
                    }
                    
                    updateOCRStatus(
                        'error',
                        'Could not detect text in image',
                        window.acScoringMode === 'brand'
                            ? 'Please type your headline manually'
                            : 'Please type your headline and CTA manually'
                    );
                }
            }).catch(function(error) {
                ocrCompleted = true;
                clearTimeout(timeout);
                console.error('OCR error:', error);
                
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'ocr_complete', {
                        'event_category': 'Tool Performance',
                        'event_label': 'OCR Error',
                        'words_detected': 0
                    });
                }
                
                updateOCRStatus('error', 'Text detection failed', 'Please enter your text manually');
            });
        }

        function performOCR(image) {
            return new Promise(function(resolve, reject) {
                try {
                    console.log('Starting OCR with Tesseract.js v5...');
                    var canvas = document.createElement('canvas');
                    var maxW = 1200;
var maxH = 900;
var scale = Math.min(maxW / image.width, maxH / image.height, 1);

canvas.width = Math.max(1, Math.round(image.width * scale));
canvas.height = Math.max(1, Math.round(image.height * scale));
var ctx = canvas.getContext('2d');
ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                    Tesseract.recognize(
                        canvas,
                        'eng',
                        { 
                            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
                            langPath: 'https://tessdata.projectnaptha.com/4.0.0',
                            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
                            logger: function(m) { 
                                if (m.status === 'recognizing text') {
                                    console.log('OCR Progress:', Math.round(m.progress * 100) + '%');
                                }
                            }
                        }
                    ).then(function(result) {
                        console.log('OCR completed successfully');
         		     // --- OCR OUTPUT ---
var text = (result.data.text || "").toString();
window.acDetectedText = text;

// --- OCR CONFIDENCE (word-level) ---
var words = (result.data && Array.isArray(result.data.words)) ? result.data.words : [];
var confidentWords = words.filter(function(w) {
  var t = (w.text || "").trim();
  var c = typeof w.confidence === "number" ? w.confidence : 0;
  // keep only real-looking words with decent confidence
  return t.length >= 2 && c >= 65 && /[A-Za-z]/.test(t);
});

var avgConf = 0;
if (confidentWords.length) {
  avgConf = confidentWords.reduce(function(sum, w) { return sum + w.confidence; }, 0) / confidentWords.length;
}

function acLooksLikeCta(textValue) {
  var value = String(textValue || '').toLowerCase();
  return /(^|\s)(visit|call|shop|learn|scan|book|order|apply|text|download|get|start|join|reserve|buy|sign up)(\s|$)/.test(value) ||
    /www\.|https?:\/\/|\.com\b|\.org\b|\.net\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(value);
}

function acBuildOcrLineCandidates(sourceWords, canvasWidth, canvasHeight) {
  var positioned = sourceWords.filter(function(w) {
    return w && w.bbox &&
      typeof w.bbox.x0 === 'number' &&
      typeof w.bbox.y0 === 'number' &&
      typeof w.bbox.x1 === 'number' &&
      typeof w.bbox.y1 === 'number';
  }).slice();

  positioned.sort(function(a, b) {
    var ay = (a.bbox.y0 + a.bbox.y1) / 2;
    var by = (b.bbox.y0 + b.bbox.y1) / 2;
    return Math.abs(ay - by) > 8 ? ay - by : a.bbox.x0 - b.bbox.x0;
  });

  var grouped = [];
  for (var i = 0; i < positioned.length; i++) {
    var word = positioned[i];
    var centerY = (word.bbox.y0 + word.bbox.y1) / 2;
    var wordHeight = Math.max(1, word.bbox.y1 - word.bbox.y0);
    var bestLine = null;
    var bestDistance = Infinity;

    for (var j = 0; j < grouped.length; j++) {
      var distance = Math.abs(grouped[j].centerY - centerY);
      var tolerance = Math.max(10, Math.max(grouped[j].avgHeight, wordHeight) * 0.7);
      if (distance <= tolerance && distance < bestDistance) {
        bestLine = grouped[j];
        bestDistance = distance;
      }
    }

    if (!bestLine) {
      bestLine = {
        words: [],
        centerY: centerY,
        avgHeight: wordHeight
      };
      grouped.push(bestLine);
    }

    bestLine.words.push(word);
    var count = bestLine.words.length;
    bestLine.centerY = ((bestLine.centerY * (count - 1)) + centerY) / count;
    bestLine.avgHeight = ((bestLine.avgHeight * (count - 1)) + wordHeight) / count;
  }

  var candidates = grouped.map(function(line) {
    line.words.sort(function(a, b) { return a.bbox.x0 - b.bbox.x0; });

    var textValue = line.words.map(function(w) { return String(w.text || '').trim(); }).join(' ').trim();
    var x0 = Math.min.apply(null, line.words.map(function(w) { return w.bbox.x0; }));
    var y0 = Math.min.apply(null, line.words.map(function(w) { return w.bbox.y0; }));
    var x1 = Math.max.apply(null, line.words.map(function(w) { return w.bbox.x1; }));
    var y1 = Math.max.apply(null, line.words.map(function(w) { return w.bbox.y1; }));
    var confidence = line.words.reduce(function(sum, w) {
      return sum + (typeof w.confidence === 'number' ? w.confidence : 0);
    }, 0) / Math.max(1, line.words.length);
    var heightNorm = (y1 - y0) / Math.max(1, canvasHeight);
    var widthNorm = (x1 - x0) / Math.max(1, canvasWidth);
    var topBias = 1 - (y0 / Math.max(1, canvasHeight));
    var wordCount = textValue ? textValue.split(/\s+/).length : 0;
    var prominence =
      (heightNorm * 6) +
      (widthNorm * 0.25) +
      (topBias * 0.15) +
      ((confidence / 100) * 0.15) -
      (Math.max(0, wordCount - 10) * 0.03);

    return {
      text: textValue,
      x0: x0 / Math.max(1, canvasWidth),
      y0: y0 / Math.max(1, canvasHeight),
      x1: x1 / Math.max(1, canvasWidth),
      y1: y1 / Math.max(1, canvasHeight),
      confidence: confidence,
      prominence: prominence,
      isCta: acLooksLikeCta(textValue)
    };
  }).filter(function(line) {
    return line.text.length >= 3 && /[A-Za-z]/.test(line.text);
  });

  candidates.sort(function(a, b) {
    return b.prominence - a.prominence;
  });

  return candidates;
}

var ocrLineCandidates = acBuildOcrLineCandidates(confidentWords, canvas.width, canvas.height);
var reliableText = ocrLineCandidates.map(function(line) { return line.text; }).join('\n').trim();

if (!reliableText) {
  reliableText = confidentWords.map(function(w) { return w.text.trim(); }).join(' ').trim();
}

window.acReliableDetectedText = reliableText;
analysisData.ocrLineCandidates = ocrLineCandidates;

var reliableEnough = reliableText.length >= 3 && avgConf >= 70 && ocrLineCandidates.length > 0;
if (!reliableEnough) {
  window.acReliableDetectedText = '';
}
		     window.acDetectedText = (text || "").toString();
                        var foundText = false;
                        
			try {
  if (result && result.data && Array.isArray(result.data.words)) {
    var boxes = [];
    var wordBoxes = [];
    var cw = canvas.width;
    var ch = canvas.height;

    result.data.words.forEach(function(word) {
      if (!word || !word.text || !word.text.trim()) return;
      var b = word.bbox;
      if (!b || typeof b.x0 !== 'number' || typeof b.y0 !== 'number') return;

      boxes.push({
        x0: Math.max(0, Math.min(1, b.x0 / cw)),
        y0: Math.max(0, Math.min(1, b.y0 / ch)),
        x1: Math.max(0, Math.min(1, b.x1 / cw)),
        y1: Math.max(0, Math.min(1, b.y1 / ch))
      });

      wordBoxes.push({
        x0: Math.max(0, Math.min(1, b.x0 / cw)),
        y0: Math.max(0, Math.min(1, b.y0 / ch)),
        x1: Math.max(0, Math.min(1, b.x1 / cw)),
        y1: Math.max(0, Math.min(1, b.y1 / ch)),
        text: (word.text || '').trim(),
        conf: (typeof word.confidence === 'number' ? word.confidence : 0)
      });
    });

    if (boxes.length) {
      analysisData.ocrBoxes = boxes;
      analysisData.ocrWordBoxes = wordBoxes;
      console.log('Stored OCR bounding boxes for heatmap:', boxes.length);
    } else {
      analysisData.ocrBoxes = [];
    }
  } else {
    analysisData.ocrBoxes = [];
  }
} catch (bboxError) {
  console.warn('Error processing OCR bounding boxes:', bboxError);
  analysisData.ocrBoxes = [];
}

var autofillSource = (window.acReliableDetectedText || '').toString().trim();

if (autofillSource.length && ocrLineCandidates.length) {
    var headlineField = document.getElementById('ac-headlineText');
    var ctaField = document.getElementById('ac-ctaText');

    var headlineCandidate = null;
    for (var hc = 0; hc < ocrLineCandidates.length; hc++) {
      if (!ocrLineCandidates[hc].isCta || ocrLineCandidates.length === 1) {
        headlineCandidate = ocrLineCandidates[hc];
        break;
      }
    }
    if (!headlineCandidate) headlineCandidate = ocrLineCandidates[0];

    var canFillHeadline = !headlineField.value.trim() || headlineField.classList.contains('ac-auto-filled');
    if (headlineCandidate && canFillHeadline) {
        headlineField.value = sanitizeText(headlineCandidate.text);
        headlineField.classList.add('ac-auto-filled');
        document.getElementById('ac-headlineBadge').style.display = 'inline';
        foundText = true;
    } else if (headlineField.value.trim()) {
        foundText = true;
    }

    if (window.acScoringMode !== 'brand') {
      var ctaCandidates = ocrLineCandidates.filter(function(line) {
        return line !== headlineCandidate && line.isCta && line.confidence >= 70;
      });
      ctaCandidates.sort(function(a, b) {
        return b.y0 - a.y0;
      });

      var canFillCta = !ctaField.value.trim() || ctaField.classList.contains('ac-auto-filled');
      if (ctaCandidates.length && canFillCta) {
        ctaField.value = sanitizeText(ctaCandidates[0].text);
        ctaField.classList.add('ac-auto-filled');
        document.getElementById('ac-ctaBadge').style.display = 'inline';
      }
    }
}                        
                        setTimeout(function() {
                            var headlineWords = document.getElementById('ac-headlineText').value.trim() ? 
                                document.getElementById('ac-headlineText').value.trim().split(/\s+/).length : 0;
                            var ctaWords = window.acScoringMode !== 'brand' && document.getElementById('ac-ctaText').value.trim() ? 
                                document.getElementById('ac-ctaText').value.trim().split(/\s+/).length : 0;
                            var bodyWords = document.getElementById('ac-bodyText').value.trim() ? 
                                document.getElementById('ac-bodyText').value.trim().split(/\s+/).length : 0;
                            var totalWords = headlineWords + ctaWords + bodyWords;
                            
                            document.getElementById('ac-headlineCount').textContent = headlineWords;
                            document.getElementById('ac-ctaCount').textContent = ctaWords;
                            document.getElementById('ac-bodyCount').textContent = bodyWords;
                            document.getElementById('ac-totalCount').textContent = totalWords;
                            
                            if (totalWords > 0) {
                                document.getElementById('ac-wordCountDisplay').style.display = 'block';
                            }
                        }, 100);
                        
                        resolve(foundText);
                    }).catch(function(error) {
                        console.error('OCR processing error:', error);
                        reject(error);
                    });
                } catch (error) {
                    console.error('OCR setup error:', error);
                    reject(error);
                }
            });
        }

        function detectPhoto(image) {
            var aspectRatio = image.width / image.height;
            var isLikelyPhoto = (aspectRatio < 1.5 || aspectRatio > 4) && image.width > 1000;
            
            if (isLikelyPhoto) {
                document.getElementById('ac-photoWarning').classList.add('show');
            }
        }

	function normalizeViewingInputs() {
    var speedInput = document.getElementById('ac-viewingSpeed');
    var distanceInput = document.getElementById('ac-viewingDistance');

    var rawSpeed = parseInt(speedInput.value, 10);
    var rawDistance = parseInt(distanceInput.value, 10);

    var changed = false;

    // default if empty
    if (isNaN(rawSpeed)) { rawSpeed = 65; changed = true; }
    if (isNaN(rawDistance)) { rawDistance = 600; changed = true; }

    // clamp to safe ranges
    var clampedSpeed = Math.min(Math.max(rawSpeed, 0), 90);
    var clampedDistance = Math.min(Math.max(rawDistance, 50), 2000);

    if (clampedSpeed !== rawSpeed || clampedDistance !== rawDistance) {
        changed = true;
    }

    speedInput.value = clampedSpeed;
    distanceInput.value = clampedDistance;

    if (changed) {
        announceToScreenReader(
          'Viewing speed and distance adjusted to realistic ranges for analysis.'
        );
    }

    return {
        speed: clampedSpeed,
        distance: clampedDistance
    };
}

        function analyzeAd() {
    try {
        if (!uploadedImage) {
            alert('Please upload an image first');
            announceToScreenReader('Please upload an image first');
            return;
        }

// Normalize speed & distance before analysis
var vd = normalizeViewingInputs();
document.getElementById('ac-viewingSpeed').value = vd.speed;
document.getElementById('ac-viewingDistance').value = vd.distance;

        	var headline = sanitizeText(document.getElementById('ac-headlineText').value);
                var cta = window.acScoringMode === 'brand'
                    ? ''
                    : sanitizeText(document.getElementById('ac-ctaText').value);
                var bodyText = sanitizeText(document.getElementById('ac-bodyText').value);

var ocrText = (window.acReliableDetectedText || window.acDetectedText || "").toString();
var imageHasText = acHasUsableTextInImage(ocrText);

// User-declared text should override OCR gating
var declaredText = (headline + ' ' + cta + ' ' + bodyText).trim();
var hasDeclaredText = declaredText.length > 0;

// Only block if BOTH are missing:
// - no reliable OCR text
// - and user provided no text
if (!imageHasText && !hasDeclaredText) {
  document.getElementById('ac-resultsSection').style.display = 'none';
  document.getElementById('ac-loadingSection').style.display = 'none';
  document.getElementById('ac-formSection').style.display = 'block';

  alert(
    "Text could not be evaluated reliably.\n\n" +
    "This image does not contain enough clear text for analysis.\n\n" +
    "To continue, please reset and upload a flat outdoor ad artwork file with clearly legible text."
  );
  return;
}
                
                var totalWords = (headline + ' ' + cta + ' ' + bodyText).trim().split(/\s+/).filter(function(w) { return w; }).length;
                
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'analyze_billboard', {
                        'event_category': 'Tool Usage',
                        'event_label': 'Analyze Button Click',
                        'total_words': totalWords,
                        'has_headline': headline ? 'yes' : 'no',
                        'has_cta': cta ? 'yes' : 'no'
                    });
                }

                announceToScreenReader('Analyzing billboard. This may take a few seconds.');

                document.getElementById('ac-formSection').style.display = 'none';
                document.getElementById('ac-loadingSection').style.display = 'block';

                setTimeout(function() {
                    try {
                        console.log('Starting analysis...');
                        performAnalysis();
                        console.log('Analysis complete!');
                        document.getElementById('ac-loadingSection').style.display = 'none';
                        document.getElementById('ac-resultsSection').style.display = 'block';
                        announceToScreenReader('Analysis complete. Results are now displayed.');
                        
                        document.getElementById('ac-resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } catch (error) {
                        console.error('Analysis error:', error);
                        alert('Error analyzing image: ' + error.message + '\nPlease try a different image or refresh the page.');
                        announceToScreenReader('Error analyzing image. Please try again.');
                        document.getElementById('ac-loadingSection').style.display = 'none';
                        document.getElementById('ac-formSection').style.display = 'block';
                    }
                }, 100);
            } catch (error) {
                console.error('Analyze error:', error);
                alert('Error starting analysis. Please refresh the page and try again.');
                announceToScreenReader('Error starting analysis');
            }
        }

function acFindCtaBBoxFromOCR(ctaTrim) {
  var wb = analysisData.ocrWordBoxes || [];
  if (!ctaTrim || !ctaTrim.trim() || wb.length === 0) return null;

  var cta = ctaTrim.toLowerCase().trim();

  var tokens = cta
    .replace(/https?:\/\//g, '')
    .replace(/[^\w.@]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  var wantsUrl = /\b(www\.)|(\.(com|net|org|io|co|ai|edu|gov|info|biz|us|ca|uk)\b)/i.test(ctaTrim);
  var wantsAt = cta.indexOf('@') !== -1;
  var wantsPhone = /(?:\+?1\s*)?(?:\(\s*\d{3}\s*\)|\d{3})[-.\s]*\d{3}[-.\s]*\d{4}\b/.test(ctaTrim);

  function isMatchWord(wt) {
    if (!wt) return false;
    var s = wt.toLowerCase();

    if (wantsUrl && (s.indexOf('www') !== -1 || s.indexOf('.com') !== -1 || s.indexOf('.net') !== -1 || s.indexOf('.org') !== -1)) return true;
    if (wantsAt && s.indexOf('@') !== -1) return true;
    if (wantsPhone && s.replace(/\D/g, '').length >= 7) return true;

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.length < 3) continue;
      if (s.indexOf(t) !== -1) return true;
    }
    return false;
  }

  var matches = [];
  for (var i = 0; i < wb.length; i++) {
    var w = wb[i];
    if (!w || !w.text) continue;
    if (w.conf < 55) continue;
    if (isMatchWord(w.text)) matches.push(w);
  }

  if (!matches.length) return null;

  var x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (var j = 0; j < matches.length; j++) {
    var m = matches[j];
    x0 = Math.min(x0, m.x0); y0 = Math.min(y0, m.y0);
    x1 = Math.max(x1, m.x1); y1 = Math.max(y1, m.y1);
  }

  return { x0:x0, y0:y0, x1:x1, y1:y1 };
}

// 1) CTA edge positioning penalty curves
function acEdgePenaltyCurve(b) {
  if (!b) return 0.15;
  var cx = (b.x0 + b.x1) / 2;
  var cy = (b.y0 + b.y1) / 2;

  var minEdge = Math.min(cx, 1 - cx, cy, 1 - cy);

  var p = 0;
  if (minEdge < 0.06) p = 0.35;
  else if (minEdge < 0.10) p = 0.25;
  else if (minEdge < 0.16) p = 0.15;
  else if (minEdge < 0.22) p = 0.08;
  else p = 0.03;

  if (cx > 0.78 && cy > 0.70) p += 0.12; // bottom-right QR corner

  return Math.min(0.50, p);
}

// 2) CTA spatial isolation factor
function acSpatialIsolationPenalty(b) {
  var boxes = analysisData.ocrBoxes || [];
  if (!b || boxes.length === 0) return 0.10;

  var padX = 0.10, padY = 0.10;
  var rx0 = Math.max(0, b.x0 - padX);
  var ry0 = Math.max(0, b.y0 - padY);
  var rx1 = Math.min(1, b.x1 + padX);
  var ry1 = Math.min(1, b.y1 + padY);

  function overlaps(a, r) {
    return !(a.x1 < r.x0 || a.x0 > r.x1 || a.y1 < r.y0 || a.y0 > r.y1);
  }

  var crowd = 0;
  for (var i = 0; i < boxes.length; i++) {
    var bb = boxes[i];
    if (!bb) continue;
    if (overlaps(bb, {x0:rx0,y0:ry0,x1:rx1,y1:ry1}) && !overlaps(bb, b)) crowd++;
  }

  if (crowd >= 14) return 0.28;
  if (crowd >= 9)  return 0.20;
  if (crowd >= 5)  return 0.12;
  return 0.06;
}

// 3) CTA competition heat weighting (proxy)
function acCompetitionHeatPenalty(b) {
  if (!b) return 0.12;
  var area = Math.max(0, (b.x1 - b.x0)) * Math.max(0, (b.y1 - b.y0));
  var crowdPenalty = acSpatialIsolationPenalty(b);

  if (area < 0.004) return Math.min(0.35, crowdPenalty + 0.14);
  if (area < 0.007) return Math.min(0.28, crowdPenalty + 0.10);
  return Math.min(0.22, crowdPenalty + 0.06);
}

// 4) CTA blur survivability modeling
function acBlurSurvivabilityPenalty(b, speed, distance, imgW, imgH) {
  if (!b || !imgW || !imgH) return 0.12;

  var bhPx = Math.max(1, (b.y1 - b.y0) * imgH);

  var speedFactor = (speed - 30) / (90 - 30);
  if (speedFactor < 0) speedFactor = 0;

  var distFactor = (distance - 200) / (1500 - 200);
  if (distFactor < 0) distFactor = 0;

  var blurRadius = 0.5 + (speedFactor * 2.5) + (distFactor * 1.5);

  var ratio = bhPx / (blurRadius * 10);

  if (ratio < 0.7) return 0.32;
  if (ratio < 1.0) return 0.22;
  if (ratio < 1.4) return 0.14;
  return 0.06;
}

function acGetActionWordBonus(ctaLower) {
  ctaLower = (ctaLower || '').toLowerCase();

  // Normalize spacing and punctuation for phrase matching
  var s = ctaLower
    .replace(/[\u2019']/g, "'")
    .replace(/[^\w\s@.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strong direct-response verbs (max bonus category)
  var core = [
    'buy','call','visit','shop','order','book','scan','download','text',
    'signup','sign up','subscribe','register','get','try','claim','enter',
    'schedule','reserve','apply','donate','join'
  ];

  // Engagement verbs (lighter bonus)
  var engage = ['discover','explore','learn','see','watch','find','view'];

  // Passive but action-oriented (still valid in OOH, lighter bonus)
  var passive = ['now open','coming soon','available','join us','now hiring'];

  // Urgency modifiers (ONLY count if paired with an action direction)
  var urgency = ['now','today','limited','ends','before','hurry'];

  function hasPhrase(list) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.indexOf(' ') !== -1) {
        if (s.indexOf(p) !== -1) return true;
      } else {
        var re = new RegExp('(^|\\s)' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)', 'i');
        if (re.test(s)) return true;
      }
    }
    return false;
  }

  var bonus = 0;

  var hasCore = hasPhrase(core);
  var hasEngage = hasPhrase(engage);
  var hasPassive = hasPhrase(passive);
  var hasUrgency = hasPhrase(urgency);

  // Bonus structure: small but meaningful, never a rescue rope
  if (hasCore) bonus = 8;
  else if (hasPassive) bonus = 5;
  else if (hasEngage) bonus = 4;

  // Urgency is a tiny modifier, and only if there is already an action direction
  if (bonus > 0 && hasUrgency) bonus += 1;

  // Clamp hard
  if (bonus > 9) bonus = 9;
  if (bonus < 0) bonus = 0;

  return bonus;
}

// Deterministic CTA scoring (simple, stable, and safe)
function acComputeCtaScore(ctaText) {
  try {
    var t = (ctaText || '').trim().toLowerCase();
    if (!t) return 0;

    var words = t.split(/\s+/).filter(Boolean);
    var wc = words.length;

// Guard: 1-letter CTA should not score high
var compact = t.replace(/[^a-z0-9]/g, '');
if (compact.length <= 1) return 22;

// Guard: 2-character CTA is usually junk, allow only specific legit cases
if (compact.length === 2) {
  var allow2 = new Set(['go']); // keep tight on purpose
  if (!allow2.has(compact)) return 35;
}

    // Base
    var score = 70;

    // Length shaping (OOH CTA should be short)
    if (wc === 1) score += 15;
    else if (wc === 2) score += 10;
    else if (wc === 3) score += 5;
    else if (wc >= 6) score -= 25;
    else if (wc >= 4) score -= 10;

    // Action word bonus
var bonus = 0;
if (typeof acGetActionWordBonus === 'function') {
  bonus = acGetActionWordBonus(ctaText); // returns 0-9
}
score += bonus;

    // Clamp
    score = Math.max(0, Math.min(100, Math.round(score)));
    return score;
  } catch (e) {
    return 0;
  }
}

        function performAnalysis() {
            try {
                console.log('=== Starting Performance Analysis ===');
                var headline = sanitizeText(document.getElementById('ac-headlineText').value);
                var cta = window.acScoringMode === 'brand'
                    ? ''
                    : sanitizeText(document.getElementById('ac-ctaText').value);
                var bodyText = sanitizeText(document.getElementById('ac-bodyText').value);
                var speed = parseInt(document.getElementById('ac-viewingSpeed').value) || 65;
                var distance = parseInt(document.getElementById('ac-viewingDistance').value) || 600;

                console.log('Input values:', { headline, cta, bodyText, speed, distance });

                var headlineWords = headline.trim() ? headline.trim().split(/\s+/).length : 0;
                var ctaWords = cta.trim() ? cta.trim().split(/\s+/).length : 0;
                var bodyWords = bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0;
                var totalWords = headlineWords + ctaWords + bodyWords;
                var hasHeadlineText = headline.trim().length > 0;
                var hasCtaText = cta.trim().length > 0;
                var hasDeclaredText = totalWords > 0;
                
                console.log('Word counts:', { headlineWords, ctaWords, bodyWords, totalWords });
                
// --- READABILITY SCORING (FORMAT-AWARE) ---
var readabilityScore = 100;

// If there is no declared text, this is not a valid OOH message test.
// We score Readability as 0 so the overall grade gets dragged down.
if (totalWords === 0) {
  readabilityScore = 0;
} else {

  // -------------------------------
  // FORMAT-AWARE WORD LIMITS
  // -------------------------------
  var boardTypeEl = document.getElementById('ac-boardType');
  var boardType = boardTypeEl ? boardTypeEl.value : 'bulletin';

  // Defaults = bulletin (highway)
  var idealLimit = 7;
  var warnLimit  = 12;

  // Poster (12' x 24')
  if (boardType === 'poster') {
    idealLimit = 10;
    warnLimit  = 18;
  }
  // Street furniture / transit shelter (5' x 11')
  else if (boardType === 'street') {
    idealLimit = 12;
    warnLimit  = 20;
  }
  // Custom stays on bulletin defaults (or you can tune later)

  // -------------------------------
  // BASE SCORE BY TOTAL WORD COUNT
  // -------------------------------
  if (totalWords <= idealLimit) {
    readabilityScore = 100;
  } else if (totalWords <= warnLimit) {
    // Gentle slope down from 100 to about 80 across the borderline range.
    var span1 = Math.max(1, (warnLimit - idealLimit));
    var over1 = (totalWords - idealLimit);
    readabilityScore = 100 - Math.round((over1 / span1) * 20); // down to ~80
  } else {
    // steeper penalties beyond warnLimit
    var over2 = (totalWords - warnLimit);
    readabilityScore = Math.max(0, 80 - (over2 * 4));
  }

  // -------------------------------
  // BONUS / PENALTY RULES
  // -------------------------------
  // Headline-focused layouts perform better in OOH
  if (bodyWords === 0 && headlineWords <= idealLimit) {
    readabilityScore = Math.min(100, readabilityScore + 5);
  } else if (bodyWords > (idealLimit + 3)) {
    // Penalize long body copy (scaled to format)
    readabilityScore -= 15;
  }

  // CTA tuning (only relevant if CTA exists; brand mode can ignore CTA score elsewhere)
  if (ctaWords > 5) {
    readabilityScore -= 10;
  } else if (ctaWords >= 1 && ctaWords <= 3) {
    readabilityScore = Math.min(100, readabilityScore + 5);
  }
}

// Clamp + normalize
readabilityScore = Math.max(0, Math.min(100, Math.round(readabilityScore)));
console.log('Readability score:', readabilityScore);

// --- REQUIRED: compute the other pillar scores BEFORE avgScore ---
var contrastScore = analyzeContrast(uploadedImage);
var clarityScore  = analyzeClarity(uploadedImage, speed, distance, totalWords, contrastScore);
var colorScore    = analyzeColors(uploadedImage);
var compositionScore = analyzeComposition(uploadedImage);
var ctaScore      = acComputeCtaScore(cta);
// Keep analysisData intact; only ensure the numeric score fields exist.
analysisData = analysisData || {};
analysisData.readability  = readabilityScore;
analysisData.contrast     = contrastScore;
analysisData.clarity      = clarityScore;
analysisData.colors       = colorScore;
analysisData.composition  = compositionScore;
analysisData.cta          = ctaScore;
console.log('Score check:', {
  readabilityScore,
  contrastScore,
  clarityScore,
  colorScore,
  compositionScore,
  ctaScore
});

// Mode-aware avg score (Direct includes CTA, Brand excludes CTA)
var avgScore = acComputeAvgScore({
  readability: readabilityScore,
  contrast: contrastScore,
  clarity: clarityScore,
  colors: colorScore,
  composition: compositionScore,
  cta: ctaScore
}, window.acScoringMode);

// New structured grade object
var gradeObj = calculateGrade(avgScore);

console.log('Average score:', avgScore, 'Grade:', gradeObj);

// Keep simple string for legacy usage (Persuasion Engine)
var grade = gradeObj.full;

/* ???? Send data to Persuasion Engine if it exists */
setTimeout(function() {
    if (typeof window.peRunFromAdCorrector === 'function') {
        try {
            console.log('Sending data to Persuasion Engine...');
            window.peRunFromAdCorrector({
                readability: readabilityScore,
                contrast: contrastScore,
                clarity: clarityScore,
                colors: colorScore,
                composition: compositionScore,
                cta: ctaScore,
                avgScore: avgScore,
                grade: grade,
                wordCount: totalWords,
                scoringMode: window.acScoringMode
            });
            console.log('Data sent successfully to Persuasion Engine');
        } catch (e) {
            console.error('Persuasion Engine hook error:', e);
        }
    } else {
        console.warn('Persuasion Engine not found on page. Make sure it\'s loaded.');
    }
}, 500);

var details = {
  headline: headline,
  cta: cta,
  wordCount: totalWords,
  hasDeclaredText: hasDeclaredText,
  grade: gradeObj.full,
  avgScore: avgScore,
  scoringMode: window.acScoringMode
};

// Store last-run data so toggle can recompute without re-analyzing
window.acLastScores = {
  readability: readabilityScore,
  contrast: contrastScore,
  clarity: clarityScore,
  colors: colorScore,
  composition: compositionScore,
  cta: ctaScore
};
window.acLastAnalysisData = analysisData;
window.acLastDetails = details;

displayGrade(gradeObj, avgScore, analysisData, details);
displayMetrics(analysisData);
displayCompliance(analysisData);
displayActionPlan(analysisData, details);
displayInsights(analysisData, details);
renderCanvases();
displayComparePanel();
acTrackUsage('analysis_completed', {
  campaign_mode: window.acScoringMode || 'direct',
  board_type: (document.getElementById('ac-boardType') || {}).value || 'unknown'
});

console.log('=== Analysis Complete ===');
            } catch (error) {
                console.error('Error in performAnalysis:', error);
                throw error;
            }
        }

/* ===============================
   Scoring Mode (Direct vs Brand)
   =============================== */

window.acScoringMode = window.acScoringMode || 'direct'; // 'direct' | 'brand'
window.acLastScores = window.acLastScores || null;
window.acLastAnalysisData = window.acLastAnalysisData || null;
window.acLastDetails = window.acLastDetails || null;

function acComputeAvgScore(scores, mode) {
  // Default to direct response
  mode = mode || 'direct';

  var r = Number(scores.readability) || 0;
  var c = Number(scores.contrast) || 0;
  var cl = Number(scores.clarity) || 0;
  var co = Number(scores.colors) || 0;
  var comp = Number(scores.composition) || 0;
  var cta = Number(scores.cta) || 0;

  if (mode === 'brand') {
    // Same base weights as direct, minus CTA, renormalized (sum of 0.84 => divide each by 0.84)
    var avgBrand =
      (r * (0.18 / 0.84)) +
      (c * (0.16 / 0.84)) +
      (cl * (0.20 / 0.84)) +
      (co * (0.14 / 0.84)) +
      (comp * (0.16 / 0.84));

    return Math.round(avgBrand);
  }

  // Direct response (includes CTA)
  var avgDirect =
    (r * 0.18) +
    (c * 0.16) +
    (cl * 0.20) +
    (co * 0.14) +
    (comp * 0.16) +
    (cta * 0.16);

  return Math.round(avgDirect);
}

function acApplyModeButtonUI(mode) {
  var directBtns = document.querySelectorAll('#ac-modeDirect');
  var brandBtns  = document.querySelectorAll('#ac-modeBrand');

  var isDirect = (mode === 'direct');

  function setState(btn, active) {
    if (!btn) return;

    btn.classList.remove('ac-mode-active');
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');

    if (active) {
      btn.classList.add('ac-mode-active');
    }
  }

  for (var i = 0; i < directBtns.length; i++) {
    setState(directBtns[i], isDirect);
  }

  for (var j = 0; j < brandBtns.length; j++) {
    setState(brandBtns[j], !isDirect);
  }
}

function acApplyCampaignModeUI(mode) {
  var isBrand = (mode === 'brand');
  var ctaGroup = document.getElementById('ac-ctaFormGroup');
  var ctaNote = document.getElementById('ac-ctaScoringNote');
  var ctaCountRow = document.getElementById('ac-ctaCountRow');
  var bestResults = document.getElementById('ac-bestResultsCopy');
  var help = document.getElementById('ac-campaignModeHelp');

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('ac-mode-hidden', hidden);
    el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  setHidden(ctaGroup, isBrand);
  setHidden(ctaNote, isBrand);
  setHidden(ctaCountRow, isBrand);

  if (bestResults) {
    bestResults.innerHTML = isBrand
      ? '<strong>For best results:</strong> Enter copy exactly as it appears on the ad. Headline and supporting text are evaluated separately. Results are directional estimates.'
      : '<strong>For best results:</strong> Enter copy exactly as it appears on the ad. Headline, CTA, and body are evaluated separately. Results are directional estimates.';
  }

  if (help) {
    help.textContent = isBrand
      ? 'Brand Awareness evaluates message clarity and recall without requiring a call to action.'
      : 'Call to Action Campaign evaluates both the message and the next step you want viewers to take.';
  }

  if (typeof window.acRefreshWordCount === 'function') {
    window.acRefreshWordCount();
  }
}

function acRecomputeFromLastRun() {
  if (!window.acLastScores || !window.acLastAnalysisData || !window.acLastDetails) return;

  var scores = window.acLastScores;

  var avgScore = acComputeAvgScore({
    readability: scores.readability,
    contrast: scores.contrast,
    clarity: scores.clarity,
    colors: scores.colors,
    composition: scores.composition,
    cta: scores.cta
  }, window.acScoringMode);

  var gradeObj = calculateGrade(avgScore);

  // update details for downstream logic
  window.acLastDetails.avgScore = avgScore;
  window.acLastDetails.grade = gradeObj.full;
  window.acLastDetails.scoringMode = window.acScoringMode;

  displayGrade(gradeObj, avgScore, window.acLastAnalysisData, window.acLastDetails);
  displayMetrics(window.acLastAnalysisData);
  displayCompliance(window.acLastAnalysisData);
  displayActionPlan(window.acLastAnalysisData, window.acLastDetails);
  displayInsights(window.acLastAnalysisData, window.acLastDetails);
  renderAnnotations();
  displayComparePanel();
    // Sync Persuasion Engine when user toggles mode (Brand vs Direct)
  if (typeof window.peRunFromAdCorrector === 'function') {
    try {
      window.peRunFromAdCorrector({
  readability: scores.readability,
  contrast: scores.contrast,
  clarity: scores.clarity,
  colors: scores.colors,
  composition: scores.composition,
  cta: scores.cta,
  avgScore: avgScore,
  grade: gradeObj.full,
  wordCount: (window.acLastDetails && window.acLastDetails.wordCount) ? window.acLastDetails.wordCount : 0,
  scoringMode: window.acScoringMode
});
    } catch (e) {
      console.error('Persuasion Engine toggle sync failed:', e);
    }
  }

  // --- SYNC SIMULATOR WITH MODE TOGGLE ---
  if (typeof acCalculateEfficacy === 'function') {
      acCalculateEfficacy();
  }
  // ---------------------------------------
}

function acBindModeButtons() {
  var directBtns = document.querySelectorAll('#ac-modeDirect');
  var brandBtns  = document.querySelectorAll('#ac-modeBrand');

  function bind(btn, mode) {
    if (!btn) return;
    btn.onclick = function(e) {
      if (e && e.preventDefault) e.preventDefault();

      window.acScoringMode = mode;
      acApplyModeButtonUI(mode);
      acApplyCampaignModeUI(mode);
      acRecomputeFromLastRun();
    };
  }

  for (var i = 0; i < directBtns.length; i++) bind(directBtns[i], 'direct');
  for (var j = 0; j < brandBtns.length; j++)  bind(brandBtns[j], 'brand');

  // Set UI on load
  acApplyModeButtonUI(window.acScoringMode || 'direct');
  acApplyCampaignModeUI(window.acScoringMode || 'direct');
}

// Bind when DOM is ready (without crashing the whole app)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', acBindModeButtons);
} else {
  acBindModeButtons();
}

        function analyzeContrast(image) {
            try {
                console.log('Analyzing contrast...');
                var canvas = document.createElement('canvas');

// Hint for frequent readback. Harmless if ignored.
var ctx = canvas.getContext('2d', { willReadFrequently: true });

// Preserve aspect ratio (avoid squishing bias)
var maxW = 420;
var maxH = 320;
var scale = Math.min(maxW / image.width, maxH / image.height, 1);
canvas.width = Math.max(1, Math.round(image.width * scale));
canvas.height = Math.max(1, Math.round(image.height * scale));

// Key stabilization for cross browser consistency
ctx.imageSmoothingEnabled = false;
if (typeof ctx.imageSmoothingQuality !== 'undefined') ctx.imageSmoothingQuality = 'low';

ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
var pixels = imageData.data;

function acLinearChannel(value) {
  var srgb = value / 255;
  return srgb <= 0.04045
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function acRelativeLuminanceAt(index) {
  return (
    0.2126 * acLinearChannel(pixels[index]) +
    0.7152 * acLinearChannel(pixels[index + 1]) +
    0.0722 * acLinearChannel(pixels[index + 2])
  );
}

function acPercentile(sortedValues, percentile) {
  if (!sortedValues.length) return 0;
  var position = (sortedValues.length - 1) * percentile;
  var lower = Math.floor(position);
  var upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  var weight = position - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function acRatioFromLuminances(values) {
  if (!values || values.length < 12) return null;
  values.sort(function(a, b) { return a - b; });
  var dark = acPercentile(values, 0.10);
  var light = acPercentile(values, 0.90);
  return (light + 0.05) / (dark + 0.05);
}

var globalLuminances = [];
for (var i = 0; i < pixels.length; i += 40) {
  globalLuminances.push(acRelativeLuminanceAt(i));
}

if (!globalLuminances.length) {
  console.warn('No luminance data, using default');
  analysisData.contrastMethod = 'Unavailable';
  analysisData.adaCompliance = 'Needs manual review';
  analysisData.contrastRatioRaw = 'N/A';
  return 75;
}

var reliableWordBoxes = (analysisData && Array.isArray(analysisData.ocrWordBoxes))
  ? analysisData.ocrWordBoxes.filter(function(word) {
      return Number(word.conf) >= 65 && String(word.text || '').trim().length >= 2;
    }).slice(0, 50)
  : [];
var localRatios = [];

for (var wb = 0; wb < reliableWordBoxes.length; wb++) {
  var wordBox = reliableWordBoxes[wb];
  var rawX0 = wordBox.x0 * canvas.width;
  var rawY0 = wordBox.y0 * canvas.height;
  var rawX1 = wordBox.x1 * canvas.width;
  var rawY1 = wordBox.y1 * canvas.height;
  var padX = Math.max(2, (rawX1 - rawX0) * 0.35);
  var padY = Math.max(2, (rawY1 - rawY0) * 0.55);
  var x0 = Math.max(0, Math.floor(rawX0 - padX));
  var y0 = Math.max(0, Math.floor(rawY0 - padY));
  var x1 = Math.min(canvas.width - 1, Math.ceil(rawX1 + padX));
  var y1 = Math.min(canvas.height - 1, Math.ceil(rawY1 + padY));
  var regionWidth = Math.max(1, x1 - x0);
  var regionHeight = Math.max(1, y1 - y0);
  var sampleStep = Math.max(1, Math.floor(Math.max(regionWidth, regionHeight) / 36));
  var regionLuminances = [];

  for (var ry = y0; ry <= y1; ry += sampleStep) {
    for (var rx = x0; rx <= x1; rx += sampleStep) {
      var regionIndex = (ry * canvas.width + rx) * 4;
      regionLuminances.push(acRelativeLuminanceAt(regionIndex));
    }
  }

  var localRatio = acRatioFromLuminances(regionLuminances);
  if (localRatio !== null && isFinite(localRatio)) localRatios.push(localRatio);
}

var contrastRatio;
var contrastMethod;
if (localRatios.length) {
  localRatios.sort(function(a, b) { return a - b; });
  contrastRatio = acPercentile(localRatios, 0.5);
  contrastMethod = 'OCR-local estimate';
} else {
  contrastRatio = acRatioFromLuminances(globalLuminances) || 1;
  contrastMethod = 'Artwork-wide estimate';
}

var contrastCheck;
if (contrastMethod === 'OCR-local estimate') {
  if (contrastRatio >= 4.5) {
    contrastCheck = 'Estimated AA';
  } else if (contrastRatio >= 3.0) {
    contrastCheck = 'Estimated large-text only';
  } else {
    contrastCheck = 'Needs contrast review';
  }
} else {
  contrastCheck = 'Artwork estimate only';
}

analysisData.contrastRatioRaw = contrastRatio.toFixed(2);
analysisData.contrastMethod = contrastMethod;
analysisData.contrastLocalSamples = localRatios.length;
analysisData.adaCompliance = contrastCheck;
                
                var score;
                if (contrastRatio >= 10) {
                    score = 100;
                } else if (contrastRatio >= 7) {
                    score = 85 + ((contrastRatio - 7) / 3) * 15;
                } else if (contrastRatio >= 4.5) {
                    score = 70 + ((contrastRatio - 4.5) / 2.5) * 15;
                } else if (contrastRatio >= 3) {
                    score = 50 + ((contrastRatio - 3) / 1.5) * 20;
                } else {
                    score = Math.max(0, ((contrastRatio - 1) / 2) * 50);
                }
                
                console.log('Contrast score:', Math.round(score), {
                  ratio: contrastRatio.toFixed(2),
                  method: contrastMethod,
                  localSamples: localRatios.length
                });
                return Math.round(score);
            } catch (error) {
                console.error('Contrast analysis error:', error);
                return 75;
            }
        }

       function analyzeClarity(image, speed, distance, totalWords, contrastScore) {
  try {
    console.log('Analyzing clarity...');

    var baseScore = 88;

    // Speed penalty (keep your intent)
    var speedPenalty = 0;
    if (speed > 55) {
      speedPenalty = Math.pow((speed - 55) / 10, 1.3) * 8;
    } else if (speed < 35) {
      baseScore += (35 - speed) * 0.3;
    }

    // Distance penalty (keep your intent)
    var distancePenalty = 0;
    if (distance > 800) {
      distancePenalty = (distance - 800) / 100 * 3;
    } else if (distance < 200) {
      distancePenalty = (200 - distance) / 50 * 4;
    }

    // Downsample for speed
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = 220;
    canvas.height = 165;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var p = img.data;

    // Convert to grayscale luminance array
    var w = canvas.width, h = canvas.height;
    var lum = new Array(w * h);
    var i, x, y, idx;

    for (i = 0; i < w * h; i++) {
      idx = i * 4;
      lum[i] = 0.2126 * p[idx] + 0.7152 * p[idx + 1] + 0.0722 * p[idx + 2];
    }

    // Sobel-ish gradient magnitude sampling (fast, ES5)
    var mags = [];
    for (y = 1; y < h - 1; y += 2) {
      for (x = 1; x < w - 1; x += 2) {
        var c = y * w + x;

        // horizontal and vertical gradients (approx)
        var gx = (lum[c + 1] - lum[c - 1]);
        var gy = (lum[c + w] - lum[c - w]);

        var mag = Math.sqrt(gx * gx + gy * gy);
        mags.push(mag);
      }
    }

    if (!mags.length) {
      console.warn('No sharpness samples, using fallback');
      var fallback = baseScore - speedPenalty - distancePenalty;
      return Math.max(0, Math.min(100, Math.round(fallback)));
    }

    mags.sort(function(a, b) { return a - b; });

    // 90th percentile = "do crisp edges exist"
    var p90Index = Math.floor(mags.length * 0.9);
    if (p90Index < 0) p90Index = 0;
    if (p90Index >= mags.length) p90Index = mags.length - 1;

    var p90 = mags[p90Index];

    // Map p90 to sharpness adjustment
    // These thresholds are tuned to avoid the "72% floor" on clean text layouts
    var sharpAdj = 0;
    if (p90 < 10) {
      sharpAdj = -14;            // very soft / blurry
    } else if (p90 < 18) {
      sharpAdj = -8;             // soft
    } else if (p90 < 28) {
      sharpAdj = -2;             // slightly soft but acceptable
    } else if (p90 < 45) {
      sharpAdj = +4;             // crisp text edges
    } else if (p90 < 70) {
      sharpAdj = +6;             // very crisp
    } else {
      sharpAdj = +3;             // extremely sharp, do not over-reward
    }

    // Density bonus (small, dynamic, only when contrast is high)
    // This prevents "simple text-only" layouts from being punished for low texture.
    var densityBonus = 0;
    if (contrastScore >= 80) {
      if (totalWords <= 5) densityBonus = 8;
      else if (totalWords <= 9) densityBonus = 4;
      else densityBonus = 0;
    }

    // Prevent blur from gaming density bonus
    if (sharpAdj <= -8) densityBonus = 0;

// ---- Copy density penalty (calibrated) ----
// Goal: penalize "too much to scan" without wrecking good minimal layouts.
var densityPenalty = 0;

// Establish a soft word budget based on viewing conditions.
// Faster + farther = less readable capacity.
var wordBudget = 9;

// speed influence (mild)
if (speed >= 70) wordBudget -= 2;
else if (speed >= 60) wordBudget -= 1;

// distance influence (mild)
if (distance >= 800) wordBudget -= 2;
else if (distance >= 650) wordBudget -= 1;

wordBudget = Math.max(5, wordBudget); // never below 5

if (totalWords > wordBudget) {
  var over = totalWords - wordBudget;

  // Small ramp. Caps so it does not become too punitive.
  densityPenalty = Math.min(12, over * 2);

  // If contrast isn't strong, density hurts more (real-world).
  if (contrastScore < 70) densityPenalty += 2;
  if (contrastScore < 55) densityPenalty += 2;
}

    var finalScore = baseScore - speedPenalty - distancePenalty + sharpAdj + densityBonus - densityPenalty;

    finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));
    console.log('Clarity score:', finalScore, {
  p90: Math.round(p90),
  sharpAdj: sharpAdj,
  densityBonus: densityBonus,
  densityPenalty: densityPenalty,
  wordBudget: wordBudget
});

    return finalScore;

  } catch (error) {
    console.error('Clarity analysis error:', error);
    var base = 85;
    var sp = (speed > 55) ? Math.max(0, (speed - 55) * 0.5) : 0;
    var dp = 0;
    if (distance > 800) dp = (distance - 800) / 100 * 3;
    var out = base - sp - dp;
    return Math.max(0, Math.min(100, Math.round(out)));
  }
}

        function analyzeColors(image) {
  try {
    console.log('Analyzing colors (noise-filtered)...');

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    // Preserve aspect ratio (avoid squishing bias)
    var maxW = 420;
    var maxH = 320;
    var scale = Math.min(maxW / image.width, maxH / image.height, 1);
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var pixels = imageData.data;

    var colorCounts = {};
    var totalSamples = 0;

    // Sampling stride: 120 bytes (~30 pixels). Good stability without being slow.
    for (var i = 0; i < pixels.length; i += 120) {
      var a = pixels[i + 3];
if (a < 16) continue; // ignore near transparent pixels

var r = Math.round(pixels[i] / 51) * 51;
var g = Math.round(pixels[i + 1] / 51) * 51;
var b = Math.round(pixels[i + 2] / 51) * 51;

// Clamp because rounding can produce 306 in rare cases
if (r > 255) r = 255;
if (g > 255) g = 255;
if (b > 255) b = 255;

      var key = r + ',' + g + ',' + b;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
      totalSamples++;
    }

    if (!totalSamples) return 80;

    // --- Noise filter ---
    // Remove tiny edge pixels created by anti-aliasing and compression artifacts.
    // Use a percentage threshold plus a minimum count so small accents do not get wiped unfairly.
    var noisePct = 0.002; // 0.2% of samples
    var noiseThreshold = Math.max(30, Math.round(totalSamples * noisePct));

    var keys = Object.keys(colorCounts);
    var validKeys = [];
    var validCounts = {};

    for (var k = 0; k < keys.length; k++) {
      var key2 = keys[k];
      if (colorCounts[key2] >= noiseThreshold) {
        validKeys.push(key2);
        validCounts[key2] = colorCounts[key2];
      }
    }

    // Fallback: if filtering kills almost everything (rare), loosen the filter automatically
    if (validKeys.length < 2 && keys.length >= 2) {
      noiseThreshold = Math.max(15, Math.round(totalSamples * 0.001)); // 0.1% or 15
      validKeys = [];
      validCounts = {};
      for (var k2 = 0; k2 < keys.length; k2++) {
        var key3 = keys[k2];
        if (colorCounts[key3] >= noiseThreshold) {
          validKeys.push(key3);
          validCounts[key3] = colorCounts[key3];
        }
      }
    }

    // If still empty (extreme edge case), use raw
    if (!validKeys.length) {
      validKeys = keys.slice(0);
      validCounts = colorCounts;
    }

    var uniqueColors = validKeys.length;

    var colorArray = validKeys.map(function(k4) {
      return { color: k4, count: validCounts[k4] };
    }).sort(function(a, b) { return b.count - a.count; });

    // Dominance based on filtered set (more accurate)
    var domPct = (colorArray[0].count / totalSamples) * 100;
    var secondPct = colorArray[1] ? (colorArray[1].count / totalSamples) * 100 : 0;

    // --- NEW: Color Blindness Check (Deuteranopia Proxy) ---
var colorBlindRisk = "Low";
if (colorArray.length >= 2) {
    var c1 = colorArray[0].color.split(',');
    var c2 = colorArray[1].color.split(',');
    var r1 = parseInt(c1[0]), g1 = parseInt(c1[1]), b1 = parseInt(c1[2]);
    var r2 = parseInt(c2[0]), g2 = parseInt(c2[1]), b2 = parseInt(c2[2]);

    var lum1 = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
    var lum2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;

    var isRed1 = (r1 > g1 + 40 && r1 > b1 + 40);
    var isGreen1 = (g1 > r1 + 40 && g1 > b1 + 40);
    var isRed2 = (r2 > g2 + 40 && r2 > b2 + 40);
    var isGreen2 = (g2 > r2 + 40 && g2 > b2 + 40);

    var isRedGreenConflict = (isRed1 && isGreen2) || (isGreen1 && isRed2);
    var lumDifference = Math.abs(lum1 - lum2);
    
    // --- UPDATED: 3-Tier Color Blindness Check ---
    if (isRedGreenConflict) {
        if (lumDifference < 70) {
            colorBlindRisk = "High (Red/Green pair lacks contrast)";
        } else if (lumDifference < 110) {
            colorBlindRisk = "Moderate (Vibration risk at speed)";
        }
    }
    // ---------------------------------------------
}
analysisData.colorBlindRisk = colorBlindRisk;

    // -----------------------
    // SCORING MODEL (OOH realistic)
    // -----------------------
    var score = 90; // start higher; clean billboards should live in 85-100 range

    // Palette complexity (filtered)
    if (uniqueColors <= 1) score -= 12;            // near-monochrome can reduce separation
    else if (uniqueColors <= 3) score += 6;        // strong brand palette
    else if (uniqueColors <= 6) score += 4;        // clean
    else if (uniqueColors <= 9) score -= 4;        // moderate complexity
    else if (uniqueColors <= 14) score -= 12;      // busy
    else score -= 22;                              // very busy

    // Dominance: do NOT punish normal brand-field dominance
    if (domPct < 12) score -= 10;                  // no clear dominant field color
    else if (domPct >= 55 && domPct <= 92) score += 4; // good hierarchy
    else if (domPct > 97) score -= 8;              // nearly flat can reduce separation

    // Accent support: reward a meaningful secondary (common in strong OOH)
    if (secondPct >= 4 && secondPct <= 28 && domPct >= 55) score += 4;

    // Clamp
    score = Math.max(0, Math.min(100, Math.round(score)));
    analysisData.colorSignals = {
      uniqueColors: uniqueColors,
      dominantPercent: Math.round(domPct),
      secondaryPercent: Math.round(secondPct),
      colorBlindRisk: colorBlindRisk
    };

    console.log('Color score:', score, {
      uniqueColors: uniqueColors,
      domPct: Math.round(domPct),
      secondPct: Math.round(secondPct),
      noiseThreshold: noiseThreshold
    });

    return score;
  } catch (error) {
    console.error('Color analysis error:', error);
    return 80;
  }
}

        function analyzeComposition(image) {
            try {
                console.log('Analyzing composition...');
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                canvas.width = Math.min(image.width, 400);
                canvas.height = Math.min(image.height, 300);
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                
                var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var pixels = imageData.data;
                
                var score = 88;
                var reasons = [];
                var strengths = [];
                
                var edges = 0;
                var threshold = 40;
                
                for (var y = 0; y < canvas.height - 1; y += 10) {
                    for (var x = 0; x < canvas.width - 1; x += 10) {
                        var idx1 = (y * canvas.width + x) * 4;
                        var idx2 = (y * canvas.width + (x + 1)) * 4;
                        
                        if (idx1 >= pixels.length || idx2 >= pixels.length) continue;
                        
                        var bright1 = (pixels[idx1] + pixels[idx1 + 1] + pixels[idx1 + 2]) / 3;
                        var bright2 = (pixels[idx2] + pixels[idx2 + 1] + pixels[idx2 + 2]) / 3;
                        
                        if (Math.abs(bright1 - bright2) > threshold) {
                            edges++;
                        }
                    }
                }
                
                var sampledPixels = Math.floor(canvas.height / 10) * Math.floor(canvas.width / 10);
                var complexityRatio = sampledPixels > 0 ? edges / sampledPixels : 0.2;
                
                if (complexityRatio > 0.5) {
                    score -= 14;
                    reasons.push({
                        key: 'visualDensity',
                        impact: 14,
                        text: 'Several high-contrast details compete for attention, which can make the visual path feel busy.'
                    });
                } else if (complexityRatio > 0.35) {
                    score -= 7;
                    reasons.push({
                        key: 'visualDensity',
                        impact: 7,
                        text: 'The layout has moderate visual competition around the main message.'
                    });
                } else if (complexityRatio < 0.06) {
                    score -= 4;
                    reasons.push({
                        key: 'lowStructure',
                        impact: 4,
                        text: 'The design may need a stronger focal relationship between the message and supporting elements.'
                    });
                } else if (complexityRatio >= 0.12 && complexityRatio <= 0.32) {
                    score += 4;
                    strengths.push('Visual activity is controlled enough to support a clear reading path.');
                }
                
                var quietPixels = 0;
                var totalSampled = 0;
                
                for (var sampleY = 0; sampleY < canvas.height - 5; sampleY += 8) {
                    for (var sampleX = 0; sampleX < canvas.width - 5; sampleX += 8) {
                        var sampleIdx = (sampleY * canvas.width + sampleX) * 4;
                        var rightIdx = (sampleY * canvas.width + (sampleX + 4)) * 4;
                        var downIdx = ((sampleY + 4) * canvas.width + sampleX) * 4;

                        var rightDiff =
                            Math.abs(pixels[sampleIdx] - pixels[rightIdx]) +
                            Math.abs(pixels[sampleIdx + 1] - pixels[rightIdx + 1]) +
                            Math.abs(pixels[sampleIdx + 2] - pixels[rightIdx + 2]);
                        var downDiff =
                            Math.abs(pixels[sampleIdx] - pixels[downIdx]) +
                            Math.abs(pixels[sampleIdx + 1] - pixels[downIdx + 1]) +
                            Math.abs(pixels[sampleIdx + 2] - pixels[downIdx + 2]);

                        if (((rightDiff + downDiff) / 6) < 22) quietPixels++;
                        totalSampled++;
                    }
                }
                
                var whitespaceRatio = totalSampled > 0 ? quietPixels / totalSampled : 0.5;
                
                if (whitespaceRatio < 0.35) {
                    score -= 10;
                    reasons.push({
                        key: 'limitedSeparation',
                        impact: 10,
                        text: 'Limited open space may make the headline, imagery, and supporting elements feel crowded.'
                    });
                } else if (whitespaceRatio < 0.5) {
                    score -= 5;
                    reasons.push({
                        key: 'limitedSeparation',
                        impact: 5,
                        text: 'A little more separation around the primary message could improve hierarchy.'
                    });
                } else if (whitespaceRatio >= 0.58) {
                    score += 6;
                    strengths.push('Low-detail space helps separate the main message from supporting content.');
                }
                
                var reliableBoxes = [];
                var ocrWords = (analysisData && Array.isArray(analysisData.ocrWordBoxes))
                    ? analysisData.ocrWordBoxes
                    : [];

                for (var b = 0; b < ocrWords.length; b++) {
                    var wordBox = ocrWords[b];
                    if (!wordBox || Number(wordBox.conf) < 65 || String(wordBox.text || '').trim().length < 2) continue;
                    reliableBoxes.push(wordBox);
                }

                var edgeCrowdingRatio = 0;
                var centroidOffset = 0;
                if (reliableBoxes.length >= 2) {
                    var nearEdgeCount = 0;
                    var cautionEdgeCount = 0;
                    var weightedX = 0;
                    var weightedY = 0;
                    var totalWeight = 0;

                    for (var rb = 0; rb < reliableBoxes.length; rb++) {
                        var reliableBox = reliableBoxes[rb];
                        var closestEdge = Math.min(
                            reliableBox.x0,
                            reliableBox.y0,
                            1 - reliableBox.x1,
                            1 - reliableBox.y1
                        );
                        if (closestEdge < 0.04) nearEdgeCount++;
                        if (closestEdge < 0.07) cautionEdgeCount++;

                        var boxWidth = Math.max(0.001, reliableBox.x1 - reliableBox.x0);
                        var boxHeight = Math.max(0.001, reliableBox.y1 - reliableBox.y0);
                        var weight = boxWidth * boxHeight;
                        weightedX += ((reliableBox.x0 + reliableBox.x1) / 2) * weight;
                        weightedY += ((reliableBox.y0 + reliableBox.y1) / 2) * weight;
                        totalWeight += weight;
                    }

                    edgeCrowdingRatio = nearEdgeCount / reliableBoxes.length;
                    var cautionRatio = cautionEdgeCount / reliableBoxes.length;

                    if (nearEdgeCount >= 2 && edgeCrowdingRatio >= 0.4) {
                        score -= 6;
                        reasons.push({
                            key: 'edgeCrowding',
                            impact: 6,
                            text: 'Several detected copy elements sit close to the outer boundary, reducing breathing room as a group.'
                        });
                    } else if (cautionEdgeCount >= 3 && cautionRatio >= 0.5) {
                        score -= 3;
                        reasons.push({
                            key: 'edgeCrowding',
                            impact: 3,
                            text: 'Multiple copy elements use a tight outer margin; a modest inset may make the layout feel more settled.'
                        });
                    } else if (nearEdgeCount === 0) {
                        score += 2;
                        strengths.push('Detected copy maintains consistent outer spacing.');
                    }

                    if (totalWeight > 0) {
                        var centerX = weightedX / totalWeight;
                        var centerY = weightedY / totalWeight;
                        centroidOffset = Math.sqrt(
                            Math.pow(centerX - 0.5, 2) +
                            Math.pow(centerY - 0.5, 2)
                        );

                        if (centroidOffset > 0.38) {
                            score -= 5;
                            reasons.push({
                                key: 'visualBalance',
                                impact: 5,
                                text: 'The detected copy weight is concentrated in one area, which may weaken the overall visual balance.'
                            });
                        } else if (centroidOffset > 0.28) {
                            score -= 3;
                            reasons.push({
                                key: 'visualBalance',
                                impact: 3,
                                text: 'The copy distribution leans to one area; check whether the imagery provides an intentional counterbalance.'
                            });
                        }
                    }
                }

                var hierarchyRatio = 0;
                var lineCandidates = (analysisData && Array.isArray(analysisData.ocrLineCandidates))
                    ? analysisData.ocrLineCandidates
                    : [];
                if (lineCandidates.length >= 2) {
                    var lineHeights = lineCandidates.map(function(line) {
                        return Math.max(0.001, Number(line.y1) - Number(line.y0));
                    }).sort(function(a, b) { return b - a; });

                    var comparisonHeight = lineHeights[Math.min(1, lineHeights.length - 1)];
                    hierarchyRatio = lineHeights[0] / Math.max(0.001, comparisonHeight);

                    if (hierarchyRatio >= 1.35) {
                        score += 4;
                        strengths.push('One copy line has enough scale difference to establish a clear focal point.');
                    } else if (lineCandidates.length >= 3 && hierarchyRatio < 1.12) {
                        score -= 4;
                        reasons.push({
                            key: 'weakHierarchy',
                            impact: 4,
                            text: 'Detected copy lines appear similar in prominence, so the first reading point may not be obvious.'
                        });
                    }
                }

                reasons.sort(function(a, b) {
                    return Number(b.impact || 0) - Number(a.impact || 0);
                });

                analysisData.compositionSignals = {
                    complexityRatio: Number(complexityRatio.toFixed(3)),
                    whitespaceRatio: Number(whitespaceRatio.toFixed(3)),
                    edgeCrowdingRatio: Number(edgeCrowdingRatio.toFixed(3)),
                    centroidOffset: Number(centroidOffset.toFixed(3)),
                    hierarchyRatio: Number(hierarchyRatio.toFixed(2)),
                    reasons: reasons,
                    strengths: strengths,
                    primaryIssue: reasons.length ? reasons[0].key : ''
                };
                
                console.log('Composition score:', Math.max(0, Math.min(100, Math.round(score))));
                return Math.max(0, Math.min(100, Math.round(score)));
            } catch (error) {
                console.error('Composition analysis error:', error);
                return 80;
            }
        }

        function calculateGrade(score) {
  // Letter
  var letter = 'F';
  if (score >= 90) letter = 'A';
  else if (score >= 80) letter = 'B';
  else if (score >= 70) letter = 'C';
  else if (score >= 60) letter = 'D';

  // Plus/minus (simple bands)
  var mod = '';
  if (letter !== 'F') {
    var ones = score % 10;
    if (ones >= 7) mod = '+';
    else if (ones <= 2) mod = '-';
  }

  return { letter: letter, mod: mod, full: letter + mod };
}

function acGetCompositionPrimaryReason(data) {
  var signals = data && data.compositionSignals;
  if (!signals || !Array.isArray(signals.reasons) || !signals.reasons.length) return null;
  return signals.reasons[0];
}

function acGetCompositionFixes(data, value) {
  var reason = acGetCompositionPrimaryReason(data);
  var key = reason ? reason.key : '';

  if (key === 'visualDensity') {
    return [
      'Reduce secondary visual details near the main message',
      'Keep one dominant focal point and make supporting elements quieter'
    ];
  }
  if (key === 'limitedSeparation') {
    return [
      'Add space between the headline, imagery, and supporting copy',
      'Group related elements so each section reads as one unit'
    ];
  }
  if (key === 'weakHierarchy') {
    return [
      'Create a clearer size difference between the headline and secondary copy',
      'Choose one element to lead the first glance'
    ];
  }
  if (key === 'visualBalance') {
    return [
      'Check whether the visual weight feels intentional across the full layout',
      'Use imagery or spacing to counterbalance the concentrated copy area'
    ];
  }
  if (key === 'edgeCrowding') {
    return [
      'Inset the outer group of copy elements slightly to create breathing room',
      'Keep outer margins consistent rather than moving one isolated element'
    ];
  }
  if (key === 'lowStructure') {
    return [
      'Strengthen the relationship between the primary message and supporting elements',
      'Use alignment or grouping to make the reading order more obvious'
    ];
  }

  if (Number(value) >= 85) {
    return [
      'The visual path appears controlled and easy to scan',
      'Preserve the current hierarchy while refining other metrics'
    ];
  }
  return [
    'Clarify which element should be seen first',
    'Review spacing, alignment, and visual weight as one system'
  ];
}

function acGetCompositionSummary(data, value) {
  var reason = acGetCompositionPrimaryReason(data);
  if (reason && Number(value) < 85) return reason.text;

  var strengths = data && data.compositionSignals && data.compositionSignals.strengths;
  if (Array.isArray(strengths) && strengths.length) return strengths[0];

  if (Number(value) >= 85) return 'The layout presents a clear visual path with controlled spacing and hierarchy.';
  if (Number(value) >= 70) return 'The layout has a workable structure, with one opportunity to improve hierarchy or separation.';
  return 'The layout would benefit from a clearer focal point and more deliberate grouping of elements.';
}

function displayGrade(gradeObj, score, data, details) {
  // gradeObj can be 'A' (legacy) or {letter,mod,full}
  var g = (typeof gradeObj === 'string')
    ? { letter: gradeObj, mod: '', full: gradeObj }
    : gradeObj;

  var gradeEl = document.getElementById('ac-gradeLetter');
  if (gradeEl) gradeEl.textContent = g.full;

  var mode = (details && details.scoringMode) ? details.scoringMode : (window.acScoringMode || 'direct');

  // --- Get format + user distance (format-aware verification) ---
  var boardTypeEl = document.getElementById('ac-boardType');
  var boardType = boardTypeEl ? boardTypeEl.value : 'bulletin';

  var distInputEl = document.getElementById('ac-viewingDistance');
  var userDist = distInputEl ? parseInt(distInputEl.value, 10) : NaN;

  // Defaults aligned to your boardType change handler:
  // bulletin=600, poster=300, street=100, custom=500 (or user input if present)
  var verifyDist = 600;
  if (boardType === 'poster') verifyDist = 300;
  else if (boardType === 'street') verifyDist = 100;
  else if (boardType === 'custom') verifyDist = isFinite(userDist) ? userDist : 500;

  // If user typed a distance, prefer it
  if (isFinite(userDist) && userDist > 0) verifyDist = userDist;

  // --- Determine weakest metric (constraint) ---
  var weakest = { key: 'readability', label: 'Readability', value: 999 };
  if (data) {
    var entries = [
      { key: 'readability', label: 'Readability', value: Number(data.readability) },
      { key: 'contrast', label: 'Contrast', value: Number(data.contrast) },
      { key: 'clarity', label: 'Clarity', value: Number(data.clarity) },
      { key: 'colors', label: 'Colors', value: Number(data.colors) },
      { key: 'composition', label: 'Composition', value: Number(data.composition) }
    ];

    if (mode !== 'brand') {
      entries.push({ key: 'cta', label: 'CTA', value: Number(data.cta) });
    }

    for (var i = 0; i < entries.length; i++) {
      if (!isFinite(entries[i].value)) continue;
      if (entries[i].value < weakest.value) weakest = entries[i];
    }
  }

  // --- CTA presence gating ---
  var rawCta = (details && typeof details.cta !== 'undefined') ? String(details.cta).trim() : '';
  var hasCtaText = rawCta.length > 0;

  if (!hasCtaText && mode !== 'brand') {
    var missing = 'CTA missing. Add an action plus an anchor (URL, phone, or location cue) before production.';
    var d0 = document.getElementById('ac-gradeDescription');
    if (d0) d0.textContent = missing;
    return;
  }

  // --- Tier messaging ---
  var msg = '';

  if (score >= 90) {
    msg = 'Production-Ready Visibility. Strong structural clarity.';
    if (weakest.value < 90) {
      msg += ' Primary constraint: ' + weakest.label + ' (' + weakest.value + '%).';
    } else {
      msg += ' Minor refinements only.';
    }
    // Context-aware verification distance
  }
  else if (score >= 80) {
    msg = 'Structurally Strong. One constraint limiting peak visibility.';
    msg += ' Primary constraint: ' + weakest.label + ' (' + weakest.value + '%).';
  }
  else if (score >= 70) {
    msg = 'Moderate Visibility Risk. Improvement required in ' + weakest.label + ' before production.';
    msg += ' Primary constraint: ' + weakest.label + ' (' + weakest.value + '%).';
  }
  else if (score >= 60) {
    msg = 'High Visibility Risk. Revision recommended before placement.';
    msg += ' Primary constraint: ' + weakest.label + ' (' + weakest.value + '%).';
  }
  else {
    msg = 'Critical Visibility Failure. Redesign required.';
    msg += ' Primary constraint: ' + weakest.label + ' (' + weakest.value + '%).';
  }

  var descEl = document.getElementById('ac-gradeDescription');
  if (descEl) descEl.textContent = msg;
}

        function displayMetrics(data) {
  var metricsGrid = document.getElementById('ac-metricsGrid');
  if (!metricsGrid) return;

  // Determine if CTA text was provided (used for CTA tile messaging)
  var ctaEl = document.getElementById('ac-ctaText');
  var hasCtaText = !!(ctaEl && String(ctaEl.value || '').trim().length);

  // Determine if Headline text was provided (used for Readability tile messaging)
  var headlineEl = document.getElementById('ac-headlineText');
  var hasHeadlineText = !!(headlineEl && String(headlineEl.value || '').trim().length);
  var currentDetails = window.acLastDetails || {};
  var currentWordCount = Number(currentDetails.wordCount) || 0;
  var speedEl = document.getElementById('ac-viewingSpeed');
  var distanceEl = document.getElementById('ac-viewingDistance');
  var currentSpeed = speedEl ? (parseInt(speedEl.value, 10) || 65) : 65;
  var currentDistance = distanceEl ? (parseInt(distanceEl.value, 10) || 600) : 600;
  var ctaBoxDetected = hasCtaText && acFindCtaBBoxFromOCR(String(ctaEl.value || '').trim());

  // SVG icons for each metric - thin line style
  var metricIcons = {
    'Readability': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>',
    'Contrast': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18"/></svg>',
    'Clarity': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 5v2"/><path d="M12 17v2"/><path d="M5 12h2"/><path d="M17 12h2"/><path d="M7.05 7.05l1.41 1.41"/><path d="M15.54 15.54l1.41 1.41"/><path d="M7.05 16.95l1.41-1.41"/><path d="M15.54 8.46l1.41-1.41"/></svg>',
    'Colors': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="4.5"/><circle cx="17.5" cy="14.5" r="4.5"/><circle cx="8.5" cy="13.5" r="4.5"/></svg>',
    'Composition': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>',
    'CTA': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 15l6 6m-6-6v4.8m0-4.8h4.8"/><rect x="3" y="3" width="9" height="9" rx="1"/><path d="M15 3h3a3 3 0 0 1 3 3v3"/><path d="M3 15v3a3 3 0 0 0 3 3h3"/></svg>'
  };

  // Tooltip descriptions for each metric
  var metricDescriptions = {
    'Readability': 'Compares the copy you entered with format-specific word limits.',
    'Contrast': 'Estimates tonal separation around text areas found in the artwork or across the overall design.',
    'Clarity': 'Combines image sharpness, copy load, viewing speed, distance, and contrast.',
    'Colors': 'Reviews palette complexity, dominant color use, and color-separation risk.',
    'Composition': 'Reviews visual density, breathing room, hierarchy, balance, and grouped spacing.',
    'CTA': 'Reviews CTA wording and its detected position when the text can be identified confidently.'
  };

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildFixes(label, value) {
    // Short, deterministic, free-tier guidance. No rabbit holes.
   if (label === 'Readability') {
      if (!hasHeadlineText && Number(value) === 0) {
        return ['Add headline text to score this category', 'Use 7 words or fewer for Bulletins and 10 or fewer for Posters as a starting target'];
      }
      if (value >= 85) return ['Preserve the current copy discipline', 'Avoid adding supporting words unless they change the takeaway'];
      if (value >= 70) return ['Trim 1-3 words from the entered copy', 'Remove filler words and lead with the clearest benefit or verb'];
      return ['Reduce the entered word count before changing the artwork', 'Keep one primary message appropriate to the selected format'];
    }

    if (label === 'Contrast') {
      if (value >= 85) return ['Preserve the current tonal separation', 'Confirm the final text and background colors in production artwork'];
      if (value >= 70) return ['Increase separation around the primary copy', 'Use a stable field or restrained overlay behind text placed on imagery'];
      return ['Use a clearly lighter-on-darker or darker-on-lighter copy treatment', 'Verify final text/background contrast in the production artwork'];
    }

    if (label === 'Clarity') {
      if (value >= 85) return ['Preserve image sharpness and the current copy load', 'Recheck clarity if speed, distance, or artwork resolution changes'];
      if (value >= 70) return ['Reduce fine detail near the primary message', 'Check source-art resolution and simplify secondary copy'];
      return ['Simplify the visual field and reduce copy load', 'Use a sharper source file and retest at the intended viewing conditions'];
    }

    if (label === 'Colors') {
      if (value >= 85) return ['Keep the palette focused and the accents intentional', 'Preserve luminance separation between important color pairs'];
      if (value >= 70) return ['Reduce competing accent colors', 'Use one dominant color field with a limited supporting palette'];
      return ['Simplify the number of significant color groups', 'Do not rely on red/green difference alone to communicate meaning'];
    }

    if (label === 'Composition') {
      return acGetCompositionFixes(data, value);
}

    // CTA
    if (!hasCtaText && Number(value) === 0) {
      return ['Add CTA text to score this category', 'Include a URL, phone, or location cue'];
    }
    if (!ctaBoxDetected) {
      return ['Keep the CTA wording short and specific', 'Confirm its size, contrast, and placement manually because its position could not be identified confidently'];
    }
    if (value >= 85) return ['Preserve the short action and concrete anchor', 'Keep the detected CTA visually distinct from supporting copy'];
    if (value >= 70) return ['Tighten the CTA to one clear instruction', 'Increase separation between the CTA and nearby elements'];
    return ['Use a direct action verb with a URL, phone, or location anchor', 'Give the CTA enough scale and contrast to be found quickly'];
  }

  function buildGuidanceHeading(value) {
    value = Number(value) || 0;
    if (value >= 95) return 'What to preserve';
    if (value >= 85) return 'How to refine';
    return 'How to improve';
  }

  function buildSummary(label, value) {
    if (label === 'CTA' && !hasCtaText && Number(value) === 0) return 'No CTA text was provided, so this category cannot be scored.';
    if (label === 'Readability' && !hasHeadlineText && Number(value) === 0) return 'No headline text was provided, so Readability cannot be scored.';
    var status = value >= 85 ? 'Strong' : (value >= 70 ? 'Workable' : 'Needs attention');

    if (label === 'Readability') {
      return status + '. The score reflects ' + currentWordCount + ' entered words against the selected format and campaign goal; it does not measure font size directly.';
    }
    if (label === 'Contrast') {
      var ratioText = data.contrastRatioRaw && data.contrastRatioRaw !== 'N/A'
        ? data.contrastRatioRaw + ':1'
        : 'an unavailable ratio';
      if (data.contrastMethod === 'OCR-local estimate') {
        return status + '. Estimated tonal separation is ' + ratioText + ' around text areas found in the artwork. Confirm exact foreground and background colors before production.';
      }
      return status + '. This estimate uses the overall artwork because individual text areas could not be measured confidently. It is not a compliance verification.';
    }
    if (label === 'Clarity') {
      return status + '. This combines image sharpness and copy load at ' + currentSpeed + ' mph and ' + currentDistance + ' ft.';
    }
    if (label === 'Colors') {
      var colorSignals = data.colorSignals || {};
      if (colorSignals.uniqueColors) {
        return status + '. The artwork contains about ' + colorSignals.uniqueColors + ' significant color groups, with a ' + colorSignals.dominantPercent + '% dominant field after noise filtering.';
      }
      return status + '. This reflects palette complexity and dominant-color separation after filtering minor compression noise.';
    }
    if (label === 'Composition') {
      return status + '. ' + acGetCompositionSummary(data, value);
    }
    if (label === 'CTA') {
      return ctaBoxDetected
        ? status + '. The score combines CTA wording with its detected position in the artwork. It does not predict conversion.'
        : status + '. The score is based mainly on CTA wording because its position could not be identified confidently. It does not predict conversion.';
    }

    return status + '. Review the guidance below for the most relevant next step.';
  }

  var mode = (window.acScoringMode || 'direct');

var metrics = [
  { label: 'Readability', value: data.readability, unit: '%' },
  { label: 'Contrast', value: data.contrast, unit: '%' },
  { label: 'Clarity', value: data.clarity, unit: '%' },
  { label: 'Colors', value: data.colors, unit: '%' },
  { label: 'Composition', value: data.composition, unit: '%' }
];

// Brand Awareness excludes CTA from scoring view
if (mode !== 'brand') {
  metrics.push({ label: 'CTA', value: data.cta, unit: '%' });
}

  var html = '';
  for (var i = 0; i < metrics.length; i++) {
    var metric = metrics[i];
    var icon = metricIcons[metric.label] || '';
    var desc = metricDescriptions[metric.label] || '';

    var extraNoteHtml = '';
    if (metric.label === 'CTA' && !hasCtaText && Number(metric.value) === 0) {
      extraNoteHtml =
        '<div class="ac-metric-note">' +
          '<div class="ac-metric-note-warn">CTA missing</div>' +
          '<div class="ac-metric-note-sub">Add CTA text to score this category.</div>' +
        '</div>';
    }
    if (metric.label === 'Readability' && !hasHeadlineText && Number(metric.value) === 0) {
      extraNoteHtml =
        '<div class="ac-metric-note">' +
          '<div class="ac-metric-note-warn">Headline missing</div>' +
          '<div class="ac-metric-note-sub">Add headline text to score this category.</div>' +
        '</div>';
    }

    var summary = buildSummary(metric.label, Number(metric.value));
    var fixes = buildFixes(metric.label, Number(metric.value));
    var guidanceHeading = buildGuidanceHeading(Number(metric.value));

    var fixesHtml = '<ul style="margin:8px 0 0 16px;padding:0;">' +
      '<li style="margin:0 0 6px 0;">' + esc(fixes[0] || '') + '</li>' +
      '<li style="margin:0;">' + esc(fixes[1] || '') + '</li>' +
    '</ul>';

    html +=
      '<div class="ac-metric-card" role="button" tabindex="0" aria-expanded="false" aria-label="' + esc(metric.label) + ' score. Click for details." title="' + esc(desc) + '" data-metric="' + esc(metric.label) + '">' +
        '<div class="ac-metric-header">' +
  '<div class="ac-metric-header-left">' +
    '<span class="ac-metric-icon">' + icon + '</span>' +
    '<span class="ac-metric-label">' + esc(metric.label) + '</span>' +
  '</div>' +
'</div>' +

'<div class="ac-metric-value-row">' +
  '<div class="ac-metric-value">' + esc(metric.value) + esc(metric.unit) + '</div>' +
  '<span class="ac-metric-chevron" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M6 9l6 6 6-6" stroke="rgba(0,0,0,0.65)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>' +
  '</span>' +
'</div>' +
extraNoteHtml +
        '<div class="ac-metric-bar" role="progressbar" aria-valuenow="' + esc(metric.value) + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(metric.label) + ' progress bar">' +
          '<div class="ac-metric-bar-fill" style="width: ' + esc(metric.value) + '%"></div>' +
        '</div>' +

        // Option A: expandable details
        '<div class="ac-metric-expand" aria-hidden="true">' +
          '<h4>What this measures</h4>' +
          '<p style="margin:0 0 10px 0;color:rgba(0,0,0,0.75);font-size:13px;line-height:1.35;">' + esc(summary) + '</p>' +
          '<h4>' + esc(guidanceHeading) + '</h4>' +
          '<div style="color:rgba(0,0,0,0.75);font-size:13px;line-height:1.35;">' + fixesHtml + '</div>' +
        '</div>' +
      '</div>';
  }

  metricsGrid.innerHTML = html;

  // Animate bars reliably
  setTimeout(function () {
    var fills = document.querySelectorAll('.adcorrector-tool .ac-metric-bar-fill');
    for (var i = 0; i < fills.length; i++) {
      var bar = fills[i];
      var val = bar.parentNode.getAttribute('aria-valuenow');
      bar.style.width = (val || '0') + '%';
    }
  }, 100);

  // Click + keyboard toggle (single-open behavior)
  function toggleCard(card) {
    if (!card) return;

    // close others
    var all = metricsGrid.querySelectorAll('.ac-metric-card');
    for (var i = 0; i < all.length; i++) {
      if (all[i] !== card) {
        all[i].classList.remove('ac-expanded');
        all[i].setAttribute('aria-expanded', 'false');
        var exp0 = all[i].querySelector('.ac-metric-expand');
        if (exp0) exp0.setAttribute('aria-hidden', 'true');
      }
    }

    var isOpen = card.classList.contains('ac-expanded');
    if (isOpen) {
      card.classList.remove('ac-expanded');
      card.setAttribute('aria-expanded', 'false');
      var exp1 = card.querySelector('.ac-metric-expand');
      if (exp1) exp1.setAttribute('aria-hidden', 'true');
    } else {
      card.classList.add('ac-expanded');
      card.setAttribute('aria-expanded', 'true');
      var exp2 = card.querySelector('.ac-metric-expand');
      if (exp2) exp2.setAttribute('aria-hidden', 'false');
    }
  }

  // Remove any prior handlers to avoid stacking
  metricsGrid.onclick = null;
  metricsGrid.onkeydown = null;

  metricsGrid.onclick = function (e) {
    var node = e.target;
    while (node && node !== metricsGrid && !node.classList.contains('ac-metric-card')) {
      node = node.parentNode;
    }
    if (node && node.classList && node.classList.contains('ac-metric-card')) {
      toggleCard(node);
    }
  };

  metricsGrid.onkeydown = function (e) {
    var key = e.key || e.keyCode;
    if (!(key === 'Enter' || key === ' ' || key === 13 || key === 32)) return;

    var node = e.target;
    if (node && node.classList && node.classList.contains('ac-metric-card')) {
      e.preventDefault();
      toggleCard(node);
    }
  };
}

function displayCompliance(data) {
    var adaEl = document.getElementById('ac-adaContrastVal');
    var ratioEl = document.getElementById('ac-contrastRatioVal');
    var cbEl = document.getElementById('ac-colorBlindVal');

    if (adaEl) {
        adaEl.textContent = data.adaCompliance || 'N/A';
    }
    if (ratioEl) {
        // Appends ":1" to the end of the raw number for standard notation (e.g., 5101.00:1)
        ratioEl.textContent = data.contrastRatioRaw ? data.contrastRatioRaw + ':1' : 'N/A';
    }
    if (cbEl) {
        cbEl.textContent = data.colorBlindRisk || 'N/A';
        // Add warning colors for High and Moderate risks
        if (data.colorBlindRisk && data.colorBlindRisk.indexOf('High') !== -1) {
            cbEl.style.color = '#ff6b6b'; // Red
        } else if (data.colorBlindRisk && data.colorBlindRisk.indexOf('Moderate') !== -1) {
            cbEl.style.color = '#ffc107'; // Yellow
        } else {
            cbEl.style.color = '#ffffff'; // White
        }
    }
}

function displayActionPlan(data, details) {
    var listEl = document.getElementById('ac-actionPlanList');
    var modeEl = document.getElementById('ac-action-plan-mode');
    if (!listEl || !data) return;

    var mode = (details && details.scoringMode) ? details.scoringMode : (window.acScoringMode || 'direct');
    var includeCTA = mode !== 'brand';
    var hasHeadlineText = !!(details && details.headline && String(details.headline).trim().length);
    var hasCtaText = !!(details && details.cta && String(details.cta).trim().length);

    if (modeEl) {
        modeEl.textContent = mode === 'brand' ? 'Brand Awareness' : 'Call to Action Campaign';
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function makeEntry(key, label, value) {
        return {
            key: key,
            label: label,
            value: Math.max(0, Math.min(100, Number(value) || 0))
        };
    }

    var entries = [
        makeEntry('readability', 'Readability', data.readability),
        makeEntry('contrast', 'Contrast', data.contrast),
        makeEntry('clarity', 'Clarity', data.clarity),
        makeEntry('colors', 'Colors', data.colors),
        makeEntry('composition', 'Composition', data.composition)
    ];

    if (includeCTA) {
        entries.push(makeEntry('cta', 'CTA', data.cta));
    }

    entries.sort(function(a, b) {
        return a.value - b.value;
    });

    function guidanceFor(entry) {
        if (entry.key === 'readability') {
            if (!hasHeadlineText && entry.value === 0) return 'Add the headline exactly as it appears, then keep the total copy inside the format word limit.';
            if (entry.value < 70) return 'Trim the copy to one dominant idea and remove supporting text that drivers cannot process at speed.';
            return 'Tighten one or two extra words so the message lands faster.';
        }
        if (entry.key === 'contrast') {
            if (entry.value < 70) return 'Increase text/background separation with a stronger light-on-dark or dark-on-light field.';
            return 'Add a cleaner field behind the main message so contrast survives distance and glare.';
        }
        if (entry.key === 'clarity') {
            if (entry.value < 70) return 'Reduce visual density near the headline and give the main message more breathing room.';
            return 'Simplify the area around the first focal point so the eye knows where to land.';
        }
        if (entry.key === 'colors') {
            if (entry.value < 70) return 'Simplify the palette and reduce competing accent colors around text.';
            return 'Keep one dominant field color and one intentional accent to protect legibility.';
        }
        if (entry.key === 'composition') {
            return acGetCompositionFixes(data, entry.value)[0];
        }
        if (entry.key === 'cta') {
            if (!hasCtaText && entry.value === 0) return 'Add a short action plus an anchor, such as a URL, phone number, or location cue.';
            if (entry.value < 70) return 'Make the CTA shorter, larger, and easier to find at a glance.';
            return 'Increase CTA dominance slightly so the next step is unmistakable.';
        }
        return 'Refine this area and re-run analysis to confirm the score change.';
    }

    var top = entries.filter(function(entry) {
        return entry.value < 85;
    }).slice(0, 3);

    if (!top.length && entries.length) {
        top = entries.slice(0, 1);
    }

    window.acLastActionPlanKeys = top.map(function(entry) {
        return entry.key;
    });

    var html = '';

    for (var i = 0; i < top.length; i++) {
        var item = top[i];
        var impact = item.value < 60 ? 'High impact' : (item.value < 80 ? 'Medium impact' : 'Polish');
        html += '<li><strong>' + esc(item.label) + ' (' + esc(item.value) + '%):</strong> ' +
            esc(guidanceFor(item)) + ' <em>' + esc(impact) + '.</em></li>';
    }

    listEl.innerHTML = html || '<li>Run analysis to generate prioritized fixes.</li>';
}

function acEscHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function acCanvasThumbnail(canvas, maxWidth) {
    if (!canvas || !canvas.width || !canvas.height) return '';

    maxWidth = maxWidth || 520;
    var scale = Math.min(1, maxWidth / canvas.width);
    var thumb = document.createElement('canvas');
    thumb.width = Math.max(1, Math.round(canvas.width * scale));
    thumb.height = Math.max(1, Math.round(canvas.height * scale));

    var tctx = thumb.getContext('2d');
    tctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);

    try {
        return thumb.toDataURL('image/jpeg', 0.82);
    } catch (e) {
        return '';
    }
}

function acReadCompareConditions() {
    var boardType = document.getElementById('ac-boardType');
    var boardLabel = boardType && boardType.options[boardType.selectedIndex]
        ? boardType.options[boardType.selectedIndex].text
        : 'Billboard';

    return {
        boardType: boardType ? boardType.value : 'bulletin',
        boardLabel: boardLabel,
        customHeight: String((document.getElementById('ac-customHeight') || {}).value || ''),
        speed: parseInt((document.getElementById('ac-viewingSpeed') || {}).value, 10) || 65,
        distance: parseInt((document.getElementById('ac-viewingDistance') || {}).value, 10) || 600,
        mode: window.acScoringMode || 'direct'
    };
}

function acFormatCompareConditions(conditions) {
    if (!conditions) return 'Conditions were not saved';
    var parts = [conditions.boardLabel || 'Billboard'];
    if (conditions.boardType === 'custom' && conditions.customHeight) {
        parts.push(conditions.customHeight + ' ft height');
    }
    parts.push((conditions.speed || 65) + ' mph');
    parts.push((conditions.distance || 600) + ' ft');
    return parts.join(' | ');
}

function acCompareConditionStatus(a, b) {
    if (!a.conditions || !b.conditions) {
        return {
            matches: false,
            message: 'Viewing conditions were not saved for one or both versions. Review score movement directionally rather than as a like-for-like comparison.'
        };
    }

    var aConditions = a.conditions;
    var bConditions = b.conditions;
    var differences = [];

    if (aConditions.boardType !== bConditions.boardType ||
        (aConditions.boardType === 'custom' && aConditions.customHeight !== bConditions.customHeight)) {
        differences.push('board format');
    }
    if (aConditions.speed !== bConditions.speed) differences.push('viewing speed');
    if (aConditions.distance !== bConditions.distance) differences.push('viewing distance');
    if (aConditions.mode !== bConditions.mode) differences.push('campaign goal');

    if (!differences.length) {
        return {
            matches: true,
            message: 'Both versions use matching board, viewing, and campaign conditions. Score movement is directionally comparable.'
        };
    }

    return {
        matches: false,
        message: 'Test conditions differ: ' + differences.join(', ') + '. Review score movement directionally rather than as a like-for-like comparison.'
    };
}

function acBuildCompareSnapshot(slot) {
    if (!window.acLastScores || !window.acLastDetails || !uploadedImage) {
        return null;
    }

    var details = window.acLastDetails || {};
    var scores = window.acLastScores || {};
    var speedCanvas = document.getElementById('ac-speedCanvas');
    var annotationCanvas = document.getElementById('ac-annotationCanvas');

    return {
        slot: slot,
        label: slot === 'a' ? 'Version A' : 'Version B',
        savedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        grade: details.grade || 'N/A',
        avgScore: Math.round(Number(details.avgScore) || 0),
        mode: details.scoringMode || window.acScoringMode || 'direct',
        conditions: acReadCompareConditions(),
        wordCount: Number(details.wordCount) || 0,
        headline: details.headline || '',
        cta: details.cta || '',
        scores: {
            readability: Number(scores.readability) || 0,
            contrast: Number(scores.contrast) || 0,
            clarity: Number(scores.clarity) || 0,
            colors: Number(scores.colors) || 0,
            composition: Number(scores.composition) || 0,
            cta: Number(scores.cta) || 0
        },
        previews: {
            speed: acCanvasThumbnail(speedCanvas, 520),
            annotations: acCanvasThumbnail(annotationCanvas, 520)
        }
    };
}

function acSaveCompareSlot(slot) {
    window.acCompareSlots = window.acCompareSlots || { a: null, b: null };

    if (!window.acLastScores || !window.acLastDetails) {
        alert('Run an analysis before saving a version.');
        return;
    }

    renderCanvases();

    var snapshot = acBuildCompareSnapshot(slot);
    if (!snapshot) {
        alert('Could not save this version. Please run analysis again.');
        return;
    }

    window.acCompareSlots[slot] = snapshot;
    var hasBothVersions = window.acCompareSlots.a && window.acCompareSlots.b;
    acTrackUsage(hasBothVersions ? 'compare_completed' : 'compare_version_saved', {
        version: slot,
        conditions_match: hasBothVersions
            ? (acCompareConditionStatus(window.acCompareSlots.a, window.acCompareSlots.b).matches ? 'yes' : 'no')
            : 'pending'
    });
    displayComparePanel();
    announceToScreenReader(snapshot.label + ' saved for comparison.');
}

function acFormatDelta(delta) {
    delta = Math.round(Number(delta) || 0);
    if (delta > 0) return '+' + delta;
    return String(delta);
}

function acDeltaClass(delta) {
    delta = Number(delta) || 0;
    if (delta > 0) return 'ac-delta-good';
    if (delta < 0) return 'ac-delta-bad';
    return '';
}

function acCompareMetricRows(a, b) {
    var rows = [
        { key: 'avgScore', label: 'Overall Score', a: a.avgScore, b: b.avgScore },
        { key: 'readability', label: 'Readability', a: a.scores.readability, b: b.scores.readability },
        { key: 'contrast', label: 'Contrast', a: a.scores.contrast, b: b.scores.contrast },
        { key: 'clarity', label: 'Clarity', a: a.scores.clarity, b: b.scores.clarity },
        { key: 'colors', label: 'Colors', a: a.scores.colors, b: b.scores.colors },
        { key: 'composition', label: 'Composition', a: a.scores.composition, b: b.scores.composition }
    ];

    if (a.mode !== 'brand' || b.mode !== 'brand') {
        rows.push({ key: 'cta', label: 'CTA', a: a.scores.cta, b: b.scores.cta });
    }

    var html = '';
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var delta = Math.round((Number(r.b) || 0) - (Number(r.a) || 0));
        html +=
            '<tr>' +
                '<td>' + acEscHtml(r.label) + '</td>' +
                '<td>' + acEscHtml(Math.round(r.a)) + '</td>' +
                '<td>' + acEscHtml(Math.round(r.b)) + '</td>' +
                '<td class="' + acDeltaClass(delta) + '">' + acEscHtml(acFormatDelta(delta)) + '</td>' +
            '</tr>';
    }

    return html;
}

function acBestCompareMovement(a, b) {
    var metrics = [
        { label: 'Readability', delta: b.scores.readability - a.scores.readability },
        { label: 'Contrast', delta: b.scores.contrast - a.scores.contrast },
        { label: 'Clarity', delta: b.scores.clarity - a.scores.clarity },
        { label: 'Colors', delta: b.scores.colors - a.scores.colors },
        { label: 'Composition', delta: b.scores.composition - a.scores.composition }
    ];

    if (a.mode !== 'brand' || b.mode !== 'brand') {
        metrics.push({ label: 'CTA', delta: b.scores.cta - a.scores.cta });
    }

    metrics.sort(function(x, y) {
        return Math.abs(y.delta) - Math.abs(x.delta);
    });

    if (!metrics.length || Math.round(metrics[0].delta) === 0) return 'No major metric movement yet';

    var top = metrics[0];
    return top.label + ' ' + acFormatDelta(top.delta);
}

function acRenderCompareVersion(slot) {
    if (!slot) {
        return '<div class="ac-compare-empty"><p><strong>Empty slot.</strong> Save the current analysis into this version.</p></div>';
    }

    var preview = slot.previews && (slot.previews.speed || slot.previews.annotations);
    var imgHtml = preview ? '<img src="' + acEscHtml(preview) + '" alt="' + acEscHtml(slot.label) + ' speed preview">' : '';
    var modeLabel = slot.mode === 'brand' ? 'Brand Awareness' : 'Call to Action Campaign';
    var conditionsLabel = acFormatCompareConditions(slot.conditions);

    return '' +
        '<div class="ac-compare-version">' +
            imgHtml +
            '<div class="ac-compare-version-body">' +
                '<p class="ac-compare-version-title">' + acEscHtml(slot.label) + ' - ' + acEscHtml(slot.grade) + ' / ' + acEscHtml(slot.avgScore) + '</p>' +
                '<p class="ac-compare-version-meta">' +
                    acEscHtml(modeLabel) + ' | ' + acEscHtml(slot.wordCount) + ' words | Saved ' + acEscHtml(slot.savedAt) +
                '</p>' +
                '<p class="ac-compare-version-meta">' + acEscHtml(conditionsLabel) + '</p>' +
            '</div>' +
        '</div>';
}

function displayComparePanel() {
    var output = document.getElementById('ac-compareOutput');
    if (!output) return;

    window.acCompareSlots = window.acCompareSlots || { a: null, b: null };
    var a = window.acCompareSlots.a;
    var b = window.acCompareSlots.b;

    if (!a && !b) {
        output.innerHTML = '<p>Save Version A and Version B to compare score movement.</p>';
        return;
    }

    if (!a || !b) {
        var saved = a || b;
        var missing = a ? 'B' : 'A';
        output.innerHTML =
            '<div class="ac-compare-versions">' +
                acRenderCompareVersion(a) +
                acRenderCompareVersion(b) +
            '</div>' +
            '<div class="ac-compare-empty"><p><strong>' + acEscHtml(saved.label) + ' saved.</strong> Analyze the other creative and save it as Version ' + acEscHtml(missing) + ' to complete the comparison.</p></div>';
        return;
    }

    var overallDelta = b.avgScore - a.avgScore;
    var winner = overallDelta > 0 ? 'Version B tests stronger' : (overallDelta < 0 ? 'Version A tests stronger' : 'Versions are tied');
    var movement = acBestCompareMovement(a, b);
    var conditionStatus = acCompareConditionStatus(a, b);

    output.innerHTML =
        '<div class="ac-compare-summary">' +
            '<div class="ac-compare-stat">' +
                '<span class="ac-compare-stat-label">Winner</span>' +
                '<span class="ac-compare-stat-value">' + acEscHtml(winner) + '</span>' +
            '</div>' +
            '<div class="ac-compare-stat">' +
                '<span class="ac-compare-stat-label">Overall Delta</span>' +
                '<span class="ac-compare-stat-value ' + acDeltaClass(overallDelta) + '">' + acEscHtml(acFormatDelta(overallDelta)) + '</span>' +
            '</div>' +
            '<div class="ac-compare-stat">' +
                '<span class="ac-compare-stat-label">Largest Movement</span>' +
                '<span class="ac-compare-stat-value">' + acEscHtml(movement) + '</span>' +
            '</div>' +
        '</div>' +
        '<div class="ac-compare-conditions' + (conditionStatus.matches ? '' : ' ac-compare-conditions-warning') + '">' +
            acEscHtml(conditionStatus.message) +
        '</div>' +
        '<div class="ac-compare-versions">' +
            acRenderCompareVersion(a) +
            acRenderCompareVersion(b) +
        '</div>' +
        '<table class="ac-compare-table">' +
            '<thead><tr><th>Metric</th><th>A</th><th>B</th><th>Delta</th></tr></thead>' +
            '<tbody>' + acCompareMetricRows(a, b) + '</tbody>' +
        '</table>';
}

function displayInsights(data, details) {
    var hasDeclaredText = !!(details && (details.hasDeclaredText || (details.wordCount > 0)));
    var fixesList = document.getElementById('ac-fixesList');
    var workingList = document.getElementById('ac-workingList');
    var mode = (details && details.scoringMode) ? details.scoringMode : (window.acScoringMode || 'direct');
    var includeCTA = (mode !== 'brand');
    var actionPlanKeys = Array.isArray(window.acLastActionPlanKeys)
        ? window.acLastActionPlanKeys
        : [];

    function isPrimaryAction(key) {
        return actionPlanKeys.indexOf(key) !== -1;
    }

    var gradeStr = (details && details.grade) ? String(details.grade) : '';
    var isATier = gradeStr.charAt(0) === 'A';

    var fixesTitle = document.getElementById('ac-fixes-title');
    if (fixesTitle) {
        fixesTitle.textContent = isATier ? 'Additional Recommendations' : 'Additional Observations';
    }

    var ctaState = 'absent';
    if (includeCTA) {
        var rawCtaText = (details && details.cta) ? String(details.cta).trim() : '';
        if (rawCtaText.length > 0) {
            ctaState = (data.cta >= 90) ? 'strong' : (data.cta < 75 ? 'weak' : 'ok');
        }
    }

    var fixes = [];
    var simSpeed = parseInt(document.getElementById('ac-viewingSpeed').value, 10) || 65;
    var simDist = parseInt(document.getElementById('ac-viewingDistance').value, 10) || 600;
    
    var boardType = document.getElementById('ac-boardType') ? document.getElementById('ac-boardType').value : 'bulletin';
    var wordBudget = (boardType === 'poster') ? 10 : (boardType === 'street' ? 12 : 7);
    if (simSpeed >= 70) wordBudget -= 2; else if (simSpeed >= 60) wordBudget -= 1;
    if (simDist >= 800) wordBudget -= 2; else if (simDist >= 650) wordBudget -= 1;
    wordBudget = Math.max(5, wordBudget);

    var actualWordCount = details.wordCount || 0;
    var wordsOverBudget = actualWordCount - wordBudget;

    // Additional observations exclude metrics already covered by Fix First Plan.
    if (data.adaCompliance === 'Needs contrast review' && !isPrimaryAction('contrast')) {
        fixes.push('Contrast Review: Estimated copy-region contrast is ' + (data.contrastRatioRaw || 'low') + ':1. Increase tonal separation and verify the final production artwork.');
    } else if (data.contrast < 60 && !isPrimaryAction('contrast')) {
        fixes.push('Contrast Warning: Increase separation between text and background so copy holds up at distance.');
    }
    if (data.colorBlindRisk &&
        data.colorBlindRisk.indexOf('High') !== -1 &&
        !isPrimaryAction('colors')) {
        fixes.push('Color Separation: Do not rely on the detected red/green pairing alone to communicate important information.');
    }

    if (!hasDeclaredText && !isPrimaryAction('readability')) {
        fixes.push(includeCTA
            ? 'Add headline and CTA text in the fields to score Readability accurately.'
            : 'Add headline text in the field to score Readability accurately.');
    } else if (wordsOverBudget > 0 &&
        data.readability < 85 &&
        !isPrimaryAction('readability')) {
        fixes.push('Scan Capacity Reached: At ' + simSpeed + ' mph, your budget is ~' + wordBudget + ' words. You are ' + wordsOverBudget + ' words over capacity.');
    }

    if (fixes.length < 3 && data.clarity < 75 && !isPrimaryAction('clarity')) {
        fixes.push('Clarity: Reduce fine detail near the main message and verify the source artwork is sharp.');
    }
    if (fixes.length < 3 && data.composition < 75 && !isPrimaryAction('composition')) {
        fixes.push('Composition: ' + acGetCompositionFixes(data, data.composition)[0] + '.');
    }
    if (fixes.length < 3 && data.colors < 85 && !isPrimaryAction('colors')) {
        fixes.push('Color Use: Reduce competing accents and preserve a clear dominant color field.');
    }
    if (includeCTA && fixes.length < 3 && data.cta < 85 && !isPrimaryAction('cta')) {
        fixes.push('CTA: Keep the instruction short and confirm that its size, contrast, and placement are easy to find.');
    }

    var noAdditionalIssues = fixes.length === 0;
    if (noAdditionalIssues) {
        fixes.push('No additional issues were identified beyond the priority plan above.');
    }

    var fixesHtml = '';
    var fixIcon = (isATier || noAdditionalIssues) ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2389ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:8px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>' 
                           : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:8px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    for (var j = 0; j < Math.min(fixes.length, 3); j++) {
        fixesHtml += '<li>' + fixIcon + sanitizeText(fixes[j]) + '</li>';
    }
    fixesList.innerHTML = fixesHtml;

    var strengthCandidates = [];

    function addStrength(key, score, text) {
        strengthCandidates.push({
            key: key,
            score: Number(score) || 0,
            text: text
        });
    }

    if (includeCTA && ctaState === 'strong') {
        addStrength('cta', data.cta, 'CTA: The action and destination are concise and easy to understand.');
    } else if (includeCTA && ctaState === 'ok') {
        addStrength('cta', data.cta, 'CTA: A clear next step is present in the entered copy.');
    }

    if (hasDeclaredText && wordsOverBudget <= 0 && data.readability >= 85) {
        addStrength('readability', data.readability, 'Readability: The entered copy stays within the estimated word budget and supports faster scanning.');
    } else if (data.readability >= 75) {
        addStrength('readability', data.readability, 'Readability: The entered copy remains workable for the selected viewing conditions.');
    }

    if (data.contrastMethod === 'OCR-local estimate' &&
        data.adaCompliance === 'Estimated AA') {
        addStrength(
            'contrast',
            data.contrast,
            'Contrast: Estimated tonal separation around detected text areas is ' + data.contrastRatioRaw + ':1. Confirm final production colors.'
        );
    }

    if (data.clarity >= 80) {
        addStrength('clarity', data.clarity, 'Clarity: Image sharpness and copy load support the selected speed and distance.');
    }

    if (data.composition >= 80) {
        addStrength('composition', data.composition, 'Composition: ' + acGetCompositionSummary(data, data.composition));
    }

    if (data.colors >= 80 &&
        (!data.colorBlindRisk || data.colorBlindRisk === 'Low')) {
        addStrength('colors', data.colors, 'Color Use: The palette remains focused without a detected high-risk color pairing.');
    }

    strengthCandidates.sort(function(a, b) {
        return b.score - a.score;
    });

    var topWorking = strengthCandidates.slice(0, 3).map(function(item) {
        return item.text;
    });

    var noValidatedStrengths = topWorking.length === 0;
    if (noValidatedStrengths) {
        topWorking = ['No clear strength reached the reporting threshold yet. Address the priority plan and re-analyze.'];
    }
    var workingHtml = '';
    var checkIcon = noValidatedStrengths
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2389ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:8px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2b8a3e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:8px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="16 8 10 14 7 11"/></svg>';
    for (var k = 0; k < topWorking.length; k++) {
        workingHtml += '<li>' + checkIcon + sanitizeText(topWorking[k]) + '</li>';
    }
    workingList.innerHTML = workingHtml;
}
       
        function renderCanvases() {
            try {
                renderOriginal();
                renderAnnotations();
                renderSpeedView();
                renderHeatmap();
      	  	renderGlare();
            } catch (error) {
                console.error('Canvas rendering error:', error);
                alert('Error rendering visualizations. Results may be incomplete.');
            }
        }

        function renderOriginal() {
            var canvas = document.getElementById('ac-originalCanvas');
            var ctx = canvas.getContext('2d');
            
            canvas.width = uploadedImage.width;
            canvas.height = uploadedImage.height;
            
            ctx.drawImage(uploadedImage, 0, 0);
        }

        function acBuildImageAnnotations() {
            var data = analysisData || {};
            var details = window.acLastDetails || {};
            var mode = (details && details.scoringMode) ? details.scoringMode : (window.acScoringMode || 'direct');
            var items = [];

            function add(key, title, detail, x, y, score) {
                items.push({
                    key: key,
                    title: title,
                    detail: detail,
                    x: Math.max(0.08, Math.min(0.92, x)),
                    y: Math.max(0.10, Math.min(0.90, y)),
                    score: Number(score) || 100
                });
            }

            if (Number(data.contrast) < 75) {
                add(
                    'contrast',
                    'Contrast risk',
                    'Text/background separation may not survive distance, motion, or glare.',
                    0.50,
                    0.42,
                    data.contrast
                );
            }

            if (Number(data.readability) < 75) {
                add(
                    'readability',
                    'Copy density risk',
                    'The message may take too long to read at this format, speed, and distance.',
                    0.48,
                    0.28,
                    data.readability
                );
            }

            if (Number(data.composition) < 78) {
                var compositionReason = acGetCompositionPrimaryReason(data);
                var compX = 0.50;
                var compY = 0.52;

                if (compositionReason && compositionReason.key === 'edgeCrowding') {
                    var reliableWords = (analysisData && Array.isArray(analysisData.ocrWordBoxes))
                        ? analysisData.ocrWordBoxes.filter(function(word) {
                            return Number(word.conf) >= 65 && String(word.text || '').trim().length >= 2;
                        })
                        : [];
                    var closestWord = null;
                    var closestDistance = 1;

                    for (var ew = 0; ew < reliableWords.length; ew++) {
                        var edgeDistance = Math.min(
                            reliableWords[ew].x0,
                            reliableWords[ew].y0,
                            1 - reliableWords[ew].x1,
                            1 - reliableWords[ew].y1
                        );
                        if (edgeDistance < closestDistance) {
                            closestDistance = edgeDistance;
                            closestWord = reliableWords[ew];
                        }
                    }

                    if (closestWord) {
                        compX = (closestWord.x0 + closestWord.x1) / 2;
                        compY = (closestWord.y0 + closestWord.y1) / 2;
                    }
                }

                add(
                    'composition',
                    'Composition opportunity',
                    compositionReason
                        ? compositionReason.text
                        : acGetCompositionSummary(data, data.composition),
                    compX,
                    compY,
                    data.composition
                );
            }

            if (Number(data.clarity) < 75) {
                add(
                    'clarity',
                    'Speed-read risk',
                    'Visual density may slow recognition when the viewer is moving.',
                    0.62,
                    0.54,
                    data.clarity
                );
            }

            if (Number(data.colors) < 75) {
                add(
                    'colors',
                    'Color complexity risk',
                    'The palette may be competing with legibility or recall.',
                    0.36,
                    0.58,
                    data.colors
                );
            }

            if (mode !== 'brand' && Number(data.cta) < 78) {
                var ctaBox = details && details.cta ? acFindCtaBBoxFromOCR(String(details.cta).trim()) : null;
                add(
                    'cta',
                    'CTA risk',
                    details && details.cta
                        ? 'The call-to-action may need more dominance, contrast, or a clearer anchor.'
                        : 'No call-to-action was provided for Call to Action Campaign scoring.',
                    ctaBox ? ((ctaBox.x0 + ctaBox.x1) / 2) : 0.72,
                    ctaBox ? ((ctaBox.y0 + ctaBox.y1) / 2) : 0.76,
                    data.cta
                );
            }

            items.sort(function(a, b) {
                return a.score - b.score;
            });

            var used = {};
            var unique = [];
            for (var j = 0; j < items.length; j++) {
                if (used[items[j].key]) continue;
                used[items[j].key] = true;
                unique.push(items[j]);
            }

            return unique.slice(0, 5);
        }

        function renderAnnotations() {
            var canvas = document.getElementById('ac-annotationCanvas');
            var listEl = document.getElementById('ac-annotationList');
            if (!canvas || !uploadedImage) return;

            var ctx = canvas.getContext('2d');
            canvas.width = uploadedImage.width;
            canvas.height = uploadedImage.height;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(uploadedImage, 0, 0);

            var annotations = acBuildImageAnnotations();
            if (!annotations.length) {
                if (listEl) {
                    listEl.innerHTML = '<p>No priority issue markers detected. Use the metric cards for polish guidance.</p>';
                }
                return;
            }

            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();

            var radius = Math.max(18, Math.min(34, canvas.width * 0.027));
            var html = '';

            function esc(s) {
                return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            }

            for (var i = 0; i < annotations.length; i++) {
                var item = annotations[i];
                var x = item.x * canvas.width;
                var y = item.y * canvas.height;

                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#ff6b6b';
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = Math.max(3, radius * 0.12);
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold ' + Math.round(radius * 1.05) + 'px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(i + 1), x, y + 1);

                html +=
                    '<div class="ac-annotation-item">' +
                        '<span class="ac-annotation-num">' + (i + 1) + '</span>' +
                        '<div>' +
                            '<p class="ac-annotation-title">' + esc(item.title) + '</p>' +
                            '<p class="ac-annotation-detail">' + esc(item.detail) + '</p>' +
                        '</div>' +
                    '</div>';
            }

            if (listEl) listEl.innerHTML = html;
        }

       function renderSpeedView() {
    var canvas = document.getElementById('ac-speedCanvas');
    if (!canvas || !uploadedImage) return;

    var ctx = canvas.getContext('2d');

    // Match original image size for consistency with other tabs
    canvas.width = uploadedImage.width;
    canvas.height = uploadedImage.height;

    // Read user inputs WITHOUT treating 0 as "empty"
    var speedRaw = parseInt(document.getElementById('ac-viewingSpeed').value, 10);
    var distanceRaw = parseInt(document.getElementById('ac-viewingDistance').value, 10);

    // Use defaults ONLY if the field is empty / NaN
    var speed = isNaN(speedRaw) ? 65 : speedRaw;          // mph
    var distance = isNaN(distanceRaw) ? 600 : distanceRaw; // feet

    // Clamp to a realistic range but allow 0
    speed = Math.min(Math.max(speed, 0), 90);             // 0-90 mph
    distance = Math.min(Math.max(distance, 0), 1500);     // 0-1500 ft

    // Update caption under the canvas
    var captionEl = document.getElementById('ac-speedCaption');
    if (captionEl) {
        if (speed <= 5) {
            captionEl.textContent = 'Stopped / Crawling - ' + Math.round(distance) + ' ft';
        } else {
            captionEl.textContent = Math.round(speed) + ' mph - ' + Math.round(distance) + ' ft';
        }
    }

    // Special case: basically standing still and very close means no blur, no trail.
    if (speed <= 5) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
        ctx.drawImage(uploadedImage, 0, 0);
        return;
    }

    // Normalize to 0-1 ranges for motion effect
    var speedFactor = (speed - 30) / (90 - 30);     // 0 at ~30 mph, 1 at 90 mph
    if (speedFactor < 0) speedFactor = 0;

    var distanceFactor = (distance - 200) / (1500 - 200); // 0 at ~200 ft, 1 at 1500 ft
    if (distanceFactor < 0) distanceFactor = 0;

    // Compute blur radius with a lighter base at low motion
    var blurRadius = 0.5 + (speedFactor * 2.5) + (distanceFactor * 1.5); // about 0.5-6px
    blurRadius = Math.min(Math.max(blurRadius, 0.5), 6);

    // Clear and render base blurred image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'blur(' + blurRadius + 'px)';
    ctx.drawImage(uploadedImage, 0, 0);

    // Motion trail: number and offset scaled by speed
    var trailCount = 2 + Math.round(speedFactor * 4); // 2-6 copies
    var maxOffset = 40 + distanceFactor * 40;         // 40-80 px

    ctx.filter = 'none';
    ctx.globalAlpha = 0.15 + (speedFactor * 0.35);    // 0.15-0.50

    for (var i = 1; i <= trailCount; i++) {
        var offset = (maxOffset / trailCount) * i;
        ctx.drawImage(uploadedImage, -offset, 0);
    }

    ctx.globalAlpha = 1.0;
}

       function renderHeatmap() {
    var canvas = document.getElementById('ac-heatmapCanvas');
    var ctx = canvas.getContext('2d');

    if (!uploadedImage) return;

    // Match original image size
    canvas.width = uploadedImage.width;
    canvas.height = uploadedImage.height;

    // Base layer: original creative
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);

    // --- Analysis canvas (small & fast) ---
    var analysisCols = 16;
    var analysisRows = 9;
    var analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = 160;
    analysisCanvas.height = 90;
    var actx = analysisCanvas.getContext('2d');

    actx.drawImage(uploadedImage, 0, 0, analysisCanvas.width, analysisCanvas.height);

    var imgData = actx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
    var pixels = imgData.data;

    var cellWidth = analysisCanvas.width / analysisCols;
    var cellHeight = analysisCanvas.height / analysisRows;

    var cells = [];
    var hasOCRBoxes = analysisData && Array.isArray(analysisData.ocrBoxes) && analysisData.ocrBoxes.length > 0;
    var ocrBoxes = hasOCRBoxes ? analysisData.ocrBoxes : [];

    // --- STEP 1: compute variance + text/layout bias per cell ---
    for (var row = 0; row < analysisRows; row++) {
        for (var col = 0; col < analysisCols; col++) {

            var xStart = Math.floor(col * cellWidth);
            var yStart = Math.floor(row * cellHeight);
            var xEnd = Math.floor((col + 1) * cellWidth);
            var yEnd = Math.floor((row + 1) * cellHeight);

            var sum = 0;
            var sumSq = 0;
            var count = 0;

            for (var y = yStart; y < yEnd; y++) {
                for (var x = xStart; x < xEnd; x++) {
                    var idx = (y * analysisCanvas.width + x) * 4;
                    if (idx + 2 >= pixels.length) continue;

                    var r = pixels[idx];
                    var g = pixels[idx + 1];
                    var b = pixels[idx + 2];

                    var bright = (r + g + b) / 3;
                    sum += bright;
                    sumSq += bright * bright;
                    count++;
                }
            }

            if (count === 0) continue;

            var mean = sum / count;
            var variance = (sumSq / count) - (mean * mean);
            if (variance < 0) variance = 0;

            // Base score from variance (visual activity)
            var baseScore = variance;

            // Layout bias: favor center / upper-center
            var cxNorm = (col + 0.5) / analysisCols;   // 0-1
            var cyNorm = (row + 0.5) / analysisRows;   // 0-1
            var dx = Math.abs(cxNorm - 0.5);
            var dy = Math.abs(cyNorm - 0.45);          // slight upper bias
            var dist = Math.sqrt(dx * dx + dy * dy);   // ~0 to ~0.7
            var layoutBias = Math.max(0, 1 - (dist / 0.7)); // 0-1, highest near center band

            // Text bias: boost cells overlapping OCR word boxes
            var textBoost = 0;
            if (hasOCRBoxes) {
                var cellX0 = col / analysisCols;
                var cellY0 = row / analysisRows;
                var cellX1 = (col + 1) / analysisCols;
                var cellY1 = (row + 1) / analysisRows;

                for (var b = 0; b < ocrBoxes.length; b++) {
                    var box = ocrBoxes[b];
                    var overlapX = Math.min(cellX1, box.x1) - Math.max(cellX0, box.x0);
                    var overlapY = Math.min(cellY1, box.y1) - Math.max(cellY0, box.y0);
                    if (overlapX > 0 && overlapY > 0) {
                        // Boost based on overlap; cap so it does not explode.
                        textBoost = baseScore * 0.7;
                        break;
                    }
                }
            }

            // Combined score:
            // - base variance
            // - + up to +30% from layout
            // - + text boost if OCR text overlaps
            var score = baseScore * (1 + 0.3 * layoutBias) + textBoost;

            cells.push({
                col: col,
                row: row,
                score: score
            });
        }
    }

    if (!cells.length) return;

    // --- STEP 2: normalize scores & classify ---
    cells.sort(function(a, b) { return b.score - a.score; });

    var maxScore = cells[0].score || 1;
    var minScore = cells[cells.length - 1].score || 0;
    var range = maxScore - minScore || 1;

    for (var i = 0; i < cells.length; i++) {
        cells[i].norm = (cells[i].score - minScore) / range;
    }

    var highThreshold = 0.75;
    var mediumThreshold = 0.5;
    var lowThreshold = 0.3;

    var maxHigh = 10;
    var maxMedium = 20;
    var maxLow = 25;
    var highCount = 0;
    var mediumCount = 0;
    var lowCount = 0;

    // --- STEP 3: draw blobs on full-size canvas ---
    for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var level = null;

        if (cell.norm >= highThreshold && highCount < maxHigh) {
            level = 'high';
            highCount++;
        } else if (cell.norm >= mediumThreshold && mediumCount < maxMedium) {
            level = 'medium';
            mediumCount++;
        } else if (cell.norm >= lowThreshold && lowCount < maxLow) {
            level = 'low';
            lowCount++;
        } else {
            continue;
        }

        var centerX = (cell.col + 0.5) / analysisCols * canvas.width;
        var centerY = (cell.row + 0.5) / analysisRows * canvas.height;

        var baseRadius = canvas.width * 0.12;
        var radiusMultiplier =
            level === 'high' ? 1.2 :
            level === 'medium' ? 1.0 : 0.8;

        var radius = baseRadius * radiusMultiplier;

        var gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

        if (level === 'high') {
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        } else if (level === 'medium') {
            gradient.addColorStop(0, 'rgba(255, 255, 0, 0.5)');
            gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(0, 255, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function renderGlare() {
            var canvas = document.getElementById('ac-glareCanvas');
            if (!canvas || !uploadedImage) return;

            var ctx = canvas.getContext('2d');
            var w = canvas.width = uploadedImage.width;
            var h = canvas.height = uploadedImage.height;

            // 1. Base Layer
            ctx.drawImage(uploadedImage, 0, 0, w, h);

            // 2. Atmospheric Washout (UV Ambient Light Scattering)
            // Vinyl reflects ambient UV, lifting the black floor to a milky grey/blue.
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = 'rgba(70, 80, 95, 0.35)'; // Cool atmospheric tint
            ctx.fillRect(0, 0, w, h);

            // 3. Luminance-Reactive Bloom (Physics-Informed Specular)
            // Real sun doesn't paint a white circle; it blows out bright pixels 
            // exponentially more than dark pixels. We create an overexposed map.
            var bloomCanvas = document.createElement('canvas');
            bloomCanvas.width = w;
            bloomCanvas.height = h;
            var bCtx = bloomCanvas.getContext('2d');

            // Define the sun's hit area (top right quadrant expanding outward)
            var cx = w * 0.7;
            var cy = h * -0.15;
            var radius = Math.max(w, h) * 1.1;
            var maskGrad = bCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            
            // Intensity curve for the light falloff
            maskGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); 
            maskGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)'); 
            maskGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.0)');

            bCtx.fillStyle = maskGrad;
            bCtx.fillRect(0, 0, w, h);

            // Mask an overexposed version of the ad inside the sun gradient
            bCtx.globalCompositeOperation = 'source-in';
            bCtx.filter = 'brightness(150%) contrast(160%) saturate(85%)';
            bCtx.drawImage(uploadedImage, 0, 0, w, h);

            // Blend the reactive bloom back onto the main canvas
            // 'color-dodge' accurately mimics intense light energy adding to pigments
            ctx.globalCompositeOperation = 'color-dodge'; 
            ctx.drawImage(bloomCanvas, 0, 0, w, h);

            // 4. Vinyl Surface Sheen (Directional Gloss)
            ctx.globalCompositeOperation = 'screen';
            var sheenGrad = ctx.createLinearGradient(0, 0, w, h);
            sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
            sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
            ctx.fillStyle = sheenGrad;
            ctx.fillRect(0, 0, w, h);

            // Reset state
            ctx.globalCompositeOperation = 'source-over';
            ctx.filter = 'none';
        }

        function switchTab(tabName) {
            try {
                var tabs = document.querySelectorAll('.adcorrector-tool .ac-tab');
                for (var i = 0; i < tabs.length; i++) {
                    tabs[i].classList.remove('active');
                    tabs[i].setAttribute('aria-selected', 'false');
                }
                
                var clickedTab = document.getElementById('tab-' + tabName);
                if (clickedTab) {
                    clickedTab.classList.add('active');
                    clickedTab.setAttribute('aria-selected', 'true');
                }

                var contents = document.querySelectorAll('.adcorrector-tool .ac-tab-content');
                for (var i = 0; i < contents.length; i++) {
                    contents[i].classList.remove('active');
                }
                
                var targetContent = document.getElementById('ac-' + tabName + 'Tab');
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                var tabNames = {
                    'original': 'Original design view',
                    'annotations': 'Issue markers view',
                    'speed': 'Speed view simulation',
                    'heatmap': 'Attention heatmap view',
		    'glare': 'Sun glare simulation'
                };
                announceToScreenReader('Switched to ' + (tabNames[tabName] || tabName));
            } catch (error) {
                console.error('Tab switch error:', error);
            }
        }

        function downloadReport() {
            try {
                                var grade = document.getElementById('ac-gradeLetter').textContent;
                var mode = (window.acScoringMode || 'direct');

                // Use last-run scores if available (matches UI behavior)
                var avgScore = null;

                if (window.acLastDetails && typeof window.acLastDetails.avgScore === 'number') {
                  avgScore = window.acLastDetails.avgScore;
                } else if (window.acLastScores) {
                  avgScore = acComputeAvgScore({
                    readability: window.acLastScores.readability,
                    contrast: window.acLastScores.contrast,
                    clarity: window.acLastScores.clarity,
                    colors: window.acLastScores.colors,
                    composition: window.acLastScores.composition,
                    cta: window.acLastScores.cta
                  }, mode);
                } else {
                  // Fallback (rare)
                  avgScore = acComputeAvgScore({
                    readability: analysisData.readability,
                    contrast: analysisData.contrast,
                    clarity: analysisData.clarity,
                    colors: analysisData.colors,
                    composition: analysisData.composition,
                    cta: analysisData.cta
                  }, mode);
                }
                
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'download_report', {
                        'event_category': 'Conversion',
                        'event_label': 'Report Downloaded',
                        'grade': grade,
                        'overall_score': Math.round(avgScore)
                    });
                }
                
                announceToScreenReader('Generating report. Download will begin shortly.');
                
                var reportCanvas = document.createElement('canvas');
                var ctx = reportCanvas.getContext('2d');
                
                reportCanvas.width = 1700;
                reportCanvas.height = 2800;
                
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, reportCanvas.width, reportCanvas.height);
                
                var headerGradient = ctx.createLinearGradient(0, 0, reportCanvas.width, 0);
                headerGradient.addColorStop(0, '#2389ff');
                headerGradient.addColorStop(1, '#0f52ba');
                ctx.fillStyle = headerGradient;
                ctx.fillRect(0, 0, reportCanvas.width, 180);
                
                ctx.fillStyle = 'white';
                ctx.font = 'bold 64px Arial';
                ctx.fillText('Ad Corrector® Analysis Report', 60, 90);
                
                ctx.font = '28px Arial';
                ctx.fillText('Billboard Creative Performance Analysis', 60, 135);
                
                var now = new Date();
                var dateStr = now.toLocaleDateString() + ' at ' + now.toLocaleTimeString();
                ctx.font = '20px Arial';
                ctx.fillText('Generated: ' + dateStr, 60, 165);
                
                var yPos = 220;

                function cleanReportText(text) {
                    return String(text || '').replace(/\s+/g, ' ').trim();
                }

                function getReportListItems(id, limit) {
                    var list = document.getElementById(id);
                    if (!list) return [];
                    var nodes = list.getElementsByTagName('li');
                    var items = [];
                    for (var n = 0; n < nodes.length && items.length < limit; n++) {
                        var text = cleanReportText(nodes[n].textContent).replace(/^[\*\-]\s*/, '');
                        if (text) items.push(text);
                    }
                    return items;
                }

                function drawWrappedText(text, x, y, maxWidth, lineHeight) {
                    var words = cleanReportText(text).split(' ');
                    var line = '';
                    for (var w = 0; w < words.length; w++) {
                        var testLine = line ? line + ' ' + words[w] : words[w];
                        if (ctx.measureText(testLine).width > maxWidth && line) {
                            ctx.fillText(line, x, y);
                            line = words[w];
                            y += lineHeight;
                        } else {
                            line = testLine;
                        }
                    }
                    if (line) {
                        ctx.fillText(line, x, y);
                        y += lineHeight;
                    }
                    return y;
                }

                function drawReportList(items, prefix, x, y, maxWidth, lineHeight, fallbackText) {
                    if (!items.length) {
                        items = [fallbackText || 'No additional items available.'];
                    }

                    for (var r = 0; r < items.length; r++) {
                        var marker = (typeof prefix === 'function') ? prefix(r) : prefix;
                        y = drawWrappedText(marker + items[r], x, y, maxWidth, lineHeight);
                        y += 8;
                    }
                    return y;
                }
                
                ctx.fillStyle = '#f8f9ff';
                ctx.fillRect(60, yPos, 400, 200);
                
                ctx.fillStyle = '#2389ff';
                ctx.font = 'bold 140px Arial';
                ctx.fillText(grade, 160, yPos + 140);
                
                ctx.fillStyle = '#333';
                ctx.font = 'bold 24px Arial';
                ctx.fillText('Overall Grade', 130, yPos + 180);
                
                ctx.fillStyle = '#333';
                ctx.font = 'bold 32px Arial';
                ctx.fillText('Executive Summary', 520, yPos + 40);
                
                var gradeDesc = document.getElementById('ac-gradeDescription').textContent;
                ctx.font = '22px Arial';
                ctx.fillStyle = '#555';
                
                var maxWidth = 1100;
                var words = gradeDesc.split(' ');
                var line = '';
                var lineHeight = 32;
                var summaryY = yPos + 80;
                
                for (var i = 0; i < words.length; i++) {
                    var testLine = line + words[i] + ' ';
                    var metrics = ctx.measureText(testLine);
                    if (metrics.width > maxWidth && i > 0) {
                        ctx.fillText(line, 520, summaryY);
                        line = words[i] + ' ';
                        summaryY += lineHeight;
                    } else {
                        line = testLine;
                    }
                }
                ctx.fillText(line, 520, summaryY);
                
                yPos = 460;
                
                ctx.fillStyle = '#333';
                ctx.font = 'bold 28px Arial';
                // Make sure Speed View reflects the current speed/distance inputs
renderSpeedView();

ctx.fillStyle = '#333';
ctx.font = 'bold 28px Arial';
ctx.fillText('Speed View', 60, yPos);

var speedCanvas = document.getElementById('ac-speedCanvas');

// Use the canvas dimensions (it matches the uploaded image size in renderSpeedView)
var imgHeight = 340;
var imgWidth = (speedCanvas.width / speedCanvas.height) * imgHeight;

// NEW: Shrink max width to 760px so we have room for proper margins
if (imgWidth > 760) {
  imgWidth = 760;
  imgHeight = (speedCanvas.height / speedCanvas.width) * imgWidth;
}

ctx.strokeStyle = '#ddd';
ctx.lineWidth = 2;
ctx.strokeRect(60, yPos + 20, imgWidth, imgHeight);
ctx.drawImage(speedCanvas, 60, yPos + 20, imgWidth, imgHeight);                
ctx.fillStyle = '#333';
ctx.font = 'bold 28px Arial';

// NEW: Shifted X-coordinate from 900 to 880 for perfect symmetry
ctx.fillText('Attention Heatmap', 880, yPos);
var heatmapCanvas = document.getElementById('ac-heatmapCanvas');
ctx.strokeRect(880, yPos + 20, imgWidth, imgHeight);
ctx.drawImage(heatmapCanvas, 880, yPos + 20, imgWidth, imgHeight);
                
                yPos = 880;
                
                ctx.fillStyle = '#2389ff';
                ctx.fillRect(0, yPos, reportCanvas.width, 4);
                
                yPos += 40;
                ctx.fillStyle = '#333';
                ctx.font = 'bold 36px Arial';
                ctx.fillText('Performance Metrics', 60, yPos);
                
                yPos += 60;
                
var metricLabels = {
  readability: 'Readability',
  contrast: 'Contrast',
  clarity: 'Clarity',
  colors: 'Color Harmony',
  composition: 'Composition',
  cta: 'CTA'
};

                                var metricKeys = ['readability','contrast','clarity','colors','composition'];
                if (mode !== 'brand') metricKeys.push('cta');
                
                var metricX = 60;
                var metricY = yPos;
                var metricWidth = 500;
                var metricHeight = 110;
                var metricGap = 40;
                
               for (var i = 0; i < metricKeys.length; i++) {
 var key = metricKeys[i];

var value = (analysisData && typeof analysisData[key] !== 'undefined')
  ? analysisData[key]
  : 0;

var label = (typeof metricLabels !== 'undefined' && metricLabels && metricLabels[key])
  ? metricLabels[key]
  : key;

if (!label) continue;

if (typeof value !== 'number') {
  value = parseFloat(value);
  if (isNaN(value)) value = 0;
}
                    
                    var col = i % 3;
                    var row = Math.floor(i / 3);
                    
                    var x = metricX + (col * (metricWidth + metricGap));
                    var y = metricY + (row * (metricHeight + metricGap));
                    
                    ctx.fillStyle = '#f8f9ff';
                    ctx.fillRect(x, y, metricWidth, metricHeight);
                    
                    ctx.fillStyle = '#666';
                    ctx.font = '20px Arial';
                    ctx.fillText(label, x + 20, y + 35);
                    
                    ctx.fillStyle = '#2389ff';
                    ctx.font = 'bold 40px Arial';
                    ctx.fillText(value + '%', x + 20, y + 75);
                    
                    var barWidth = metricWidth - 200;
                    var barX = x + metricWidth - barWidth - 20;
                    var barY = y + 45;
                    
                    ctx.fillStyle = '#e0e0e0';
                    ctx.fillRect(barX, barY, barWidth, 20);
                    
                    var barGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
                    barGradient.addColorStop(0, '#2389ff');
                    barGradient.addColorStop(1, '#0f52ba');
                    ctx.fillStyle = barGradient;
                    ctx.fillRect(barX, barY, barWidth * (value / 100), 20);
                }
                
                // --- NEW: COMPLIANCE SECTION FOR REPORT ---
                var complianceY = metricY + (2 * metricHeight) + metricGap + 40; 
                
                ctx.fillStyle = '#333';
                ctx.font = 'bold 28px Arial';
                ctx.fillText('Contrast & Accessibility Estimates', 60, complianceY);
                
                complianceY += 40;
                var compLabels = ['Contrast Check', 'Estimated Ratio', 'Color Blind Risk'];
                var compVals = [
                    analysisData.adaCompliance || 'N/A',
                    analysisData.contrastRatioRaw ? analysisData.contrastRatioRaw + ':1' : 'N/A',
                    analysisData.colorBlindRisk || 'N/A'
                ];
                
                for (var c = 0; c < 3; c++) {
                    var cx = metricX + (c * (metricWidth + metricGap));
                    
                    // Draw dark card background to match the UI vibe
                    ctx.fillStyle = '#0f172a'; 
                    ctx.fillRect(cx, complianceY, metricWidth, 100);
                    
                    // Draw Label
                    ctx.fillStyle = '#94a3b8'; 
                    ctx.font = 'bold 16px Arial';
                    ctx.fillText(compLabels[c].toUpperCase(), cx + 25, complianceY + 35);
                    
                    // Draw Value with conditional warning colors
                    if (c === 2 && compVals[c].indexOf('High') !== -1) {
                        ctx.fillStyle = '#ff6b6b'; // Red
                    } else if (c === 2 && compVals[c].indexOf('Moderate') !== -1) {
                        ctx.fillStyle = '#ffc107'; // Yellow
                    } else {
                        ctx.fillStyle = '#ffffff'; // White
                    }
                    
                    // --- NEW: Shrink font if text is long to prevent cutoff ---
                    if (compVals[c].length > 15) {
                        ctx.font = 'bold 22px Arial'; 
                    } else {
                        ctx.font = 'bold 32px Arial';
                    }
                    
                    ctx.fillText(compVals[c], cx + 25, complianceY + 75);
                }
                // ------------------------------------------
                
                yPos = 1560; // Shifted down from 1360 to make room
                ctx.fillStyle = '#333';
                ctx.font = 'bold 36px Arial';
                ctx.fillText('Key Insights & Recommendations', 60, yPos);
                
                yPos += 50;
                
                ctx.fillStyle = '#0f52ba';
                ctx.font = 'bold 28px Arial';
                ctx.fillText('Fix First Plan', 60, yPos);

                ctx.fillStyle = '#333';
                ctx.font = '22px Arial';
                yPos += 40;

                var priorityItems = getReportListItems('ac-actionPlanList', 3);
                yPos = drawReportList(priorityItems, function(index) {
                    return (index + 1) + '. ';
                }, 80, yPos, 1460, 30, 'No priority fixes identified. Review the metric breakdown for light optimization opportunities.');

                yPos += 24;

                ctx.fillStyle = '#2b8a3e';
                ctx.font = 'bold 28px Arial';
                ctx.fillText('What\'s Working', 60, yPos);
                
                ctx.fillStyle = '#333';
                ctx.font = '22px Arial';
                yPos += 40;
                
                var workingItems = getReportListItems('ac-workingList', 3);
                yPos = drawReportList(workingItems, 'Working: ', 80, yPos, 1460, 30, 'No clear strength reached the reporting threshold yet. Address the priority plan and re-analyze.');
                
                yPos += 24;

                ctx.fillStyle = '#ff6b6b';
                ctx.font = 'bold 28px Arial';
                var isATier = String(grade || '').charAt(0) === 'A';
var fixesHeading = isATier ? 'Additional Recommendations' : 'Additional Observations';
                ctx.fillText(fixesHeading, 60, yPos);
                
                ctx.fillStyle = '#333';
                ctx.font = '22px Arial';
                yPos += 40;
                
                var observationItems = getReportListItems('ac-fixesList', 3);
                yPos = drawReportList(observationItems, function(index) {
                    return (index + 1) + '. ';
                }, 80, yPos, 1460, 30, 'No additional observations beyond the Fix First Plan above.');
                
                yPos += 50;
                
                ctx.fillStyle = '#2389ff';
                ctx.fillRect(0, yPos, reportCanvas.width, 4);
                
                yPos += 40;
                ctx.fillStyle = '#333';
                ctx.font = 'bold 32px Arial';
                ctx.fillText('How to Use These Results', 60, yPos);
                
                ctx.font = '22px Arial';
                ctx.fillStyle = '#555';
                yPos += 45;
          
                ctx.font = '22px Arial';
                ctx.fillStyle = '#555';
                
		var recommendations = [];

		recommendations.push('Start with the Fix First Plan, then review any additional observations.');
		recommendations.push('After updates, re-analyze to confirm improvements and catch new issues.');
		recommendations.push('Use the attention heatmap and speed view to validate hierarchy and visibility.');
		                              
                for (var i = 0; i < recommendations.length; i++) {
                    yPos = drawWrappedText(recommendations[i], 80, yPos, 1460, 30);
                    yPos += 8;
                }
                
                yPos = reportCanvas.height - 100;
                
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0, yPos, reportCanvas.width, 100);
                
                ctx.fillStyle = '#888';
                ctx.font = 'italic 18px Arial';
                ctx.fillText('Generated by Ad Corrector® - Professional Billboard Visibility Analysis Tool', 60, yPos + 40);
                ctx.fillText('Directional estimate only. Not legal, accessibility, production, media-owner, or performance certification.', 60, yPos + 65);
                
                var fileName = 'AdCorrector-Report-' + Date.now() + '.png';

                function triggerReportDownload(blob) {
                    var url = URL.createObjectURL(blob);
                    var link = document.createElement('a');
                    link.download = fileName;
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener';
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();

                    setTimeout(function() {
                        URL.revokeObjectURL(url);
                        if (link.parentNode) {
                            link.parentNode.removeChild(link);
                        }
                    }, 4000);

                    announceToScreenReader('Report download started. On mobile, check Downloads or Files if the image does not open automatically.');
                }

                function openReportFallback() {
                    var fallbackLink = document.createElement('a');
                    fallbackLink.download = fileName;
                    fallbackLink.href = reportCanvas.toDataURL('image/png');
                    fallbackLink.target = '_blank';
                    fallbackLink.rel = 'noopener';
                    fallbackLink.style.display = 'none';
                    document.body.appendChild(fallbackLink);
                    fallbackLink.click();
                    if (fallbackLink.parentNode) {
                        fallbackLink.parentNode.removeChild(fallbackLink);
                    }
                    announceToScreenReader('Report opened. On mobile, use Save Image or Share if prompted.');
                }

                if (reportCanvas.toBlob) {
                    reportCanvas.toBlob(function(blob) {
                        if (!blob) {
                            openReportFallback();
                            return;
                        }

                        var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
                        if (isMobile && navigator.share && navigator.canShare && typeof File !== 'undefined') {
                            try {
                                var reportFile = new File([blob], fileName, { type: 'image/png' });
                                if (navigator.canShare({ files: [reportFile] })) {
                                    navigator.share({
                                        files: [reportFile],
                                        title: 'Ad Corrector® Report',
                                        text: 'Ad Corrector® directional analysis report'
                                    }).then(function() {
                                        announceToScreenReader('Report ready to save or share.');
                                    }).catch(function(shareError) {
                                        if (shareError && shareError.name === 'AbortError') {
                                            announceToScreenReader('Report export canceled.');
                                        } else {
                                            triggerReportDownload(blob);
                                        }
                                    });
                                    return;
                                }
                            } catch (shareSetupError) {
                                console.warn('Mobile share export unavailable:', shareSetupError);
                            }
                        }

                        triggerReportDownload(blob);
                    }, 'image/png');
                } else {
                    openReportFallback();
                }
            } catch (error) {
                console.error('Report generation error:', error);
                alert('Error generating report. Please try again.');
                announceToScreenReader('Error generating report');
            }
        }

        function exportJSONData() {
            try {
                var mode = window.acScoringMode || 'direct';
                var exportObj = {
                    "ad_corrector_version": "2.2",
                    "timestamp": new Date().toISOString(),
                    "mode": mode,
                    "overall_grade": window.acLastDetails ? window.acLastDetails.grade : "N/A",
                    "overall_score": window.acLastDetails ? window.acLastDetails.avgScore : 0,
                    "metrics": window.acLastScores || {},
                    "compliance": {
                        "ada_contrast": analysisData.adaCompliance || "N/A",
                        "contrast_ratio": analysisData.contrastRatioRaw || "N/A",
                        "contrast_method": analysisData.contrastMethod || "N/A",
                        "contrast_local_samples": analysisData.contrastLocalSamples || 0,
                        "color_blind_risk": analysisData.colorBlindRisk || "N/A"
                    },
                    "context": {
                        "word_count": window.acLastDetails ? window.acLastDetails.wordCount : 0,
                        "simulated_speed_mph": parseInt(document.getElementById('ac-viewingSpeed').value) || 65,
                        "simulated_distance_ft": parseInt(document.getElementById('ac-viewingDistance').value) || 600
                    }
                };

                var jsonString = JSON.stringify(exportObj, null, 2);
                navigator.clipboard.writeText(jsonString).then(function() {
                    alert("Analysis data copied to clipboard as JSON!");
                    announceToScreenReader('JSON data exported to clipboard');
                }).catch(function(err) {
                    console.error("Clipboard write failed:", err);
                    alert("Could not copy to clipboard. Check browser permissions.");
                });
            } catch (error) {
                console.error('JSON export error:', error);
                alert('Error exporting JSON data.');
            }
        }

        function resetTool() {
            try {
                uploadedImage = null;
                currentTool = null;
                analysisData = {};
                window.acDetectedText = '';
                window.acReliableDetectedText = '';
                
                document.getElementById('ac-uploadSection').style.display = 'block';
                document.getElementById('ac-formSection').style.display = 'none';
                document.getElementById('ac-resultsSection').style.display = 'none';
                document.getElementById('ac-photoWarning').classList.remove('show');
                
                var ocrStatus = document.getElementById('ac-ocrStatus');
if (ocrStatus && ocrStatus.parentNode) {
  ocrStatus.parentNode.removeChild(ocrStatus);
}
                
                document.getElementById('ac-wordCountDisplay').style.display = 'none';
                
                document.getElementById('ac-headlineBadge').style.display = 'none';
                document.getElementById('ac-ctaBadge').style.display = 'none';
                document.getElementById('ac-bodyBadge').style.display = 'none';
                
                document.getElementById('ac-headlineText').classList.remove('ac-auto-filled');
                document.getElementById('ac-ctaText').classList.remove('ac-auto-filled');
                document.getElementById('ac-bodyText').classList.remove('ac-auto-filled');
                
                document.getElementById('ac-fileInput').value = '';
                document.getElementById('ac-headlineText').value = '';
                document.getElementById('ac-ctaText').value = '';
                document.getElementById('ac-bodyText').value = '';
                
                document.getElementById('ac-boardType').value = 'bulletin';
                document.getElementById('ac-viewingSpeed').value = 65;
                document.getElementById('ac-viewingDistance').value = 600;
                document.getElementById('ac-customSizeGroup').style.display = 'none';
                document.getElementById('ac-customHeight').value = '';
                syncScenarioControlsFromInputs();
                setViewingPresetState(null);

                window.acLastScores = null;
                window.acLastAnalysisData = null;
                window.acLastDetails = null;
                window.acLastActionPlanKeys = [];

                var actionPlanList = document.getElementById('ac-actionPlanList');
                if (actionPlanList) actionPlanList.innerHTML = '<li>Run analysis to generate prioritized fixes.</li>';
                var actionPlanMode = document.getElementById('ac-action-plan-mode');
                if (actionPlanMode) {
                    actionPlanMode.textContent = window.acScoringMode === 'brand'
                        ? 'Brand Awareness'
                        : 'Call to Action Campaign';
                }
                acApplyModeButtonUI(window.acScoringMode || 'direct');
                acApplyCampaignModeUI(window.acScoringMode || 'direct');
                
                // --- RESET BUDGET EFFICACY SIMULATOR ---
                var effPanel = document.getElementById('ac-efficacy-panel');
                if (effPanel) effPanel.style.display = 'none';

                var effResults = document.getElementById('ac-efficacy-results');
                if (effResults) effResults.style.display = 'none';

                var effBudget = document.getElementById('ac-eff-budget');
                if (effBudget) effBudget.value = '';

                var effDec = document.getElementById('ac-eff-dec');
                if (effDec) effDec.value = '';

                var effModal = document.getElementById('ac-efficacy-modal');
                if (effModal) effModal.style.display = 'none';
                // ---------------------------------------
                
                var allTabs = document.querySelectorAll('.adcorrector-tool .ac-tab');
                var allTabContents = document.querySelectorAll('.adcorrector-tool .ac-tab-content');
                
                for (var i = 0; i < allTabs.length; i++) {
                    allTabs[i].classList.remove('active');
                    allTabs[i].setAttribute('aria-selected', 'false');
                }
                for (var i = 0; i < allTabContents.length; i++) {
                    allTabContents[i].classList.remove('active');
                }
                
                if (allTabs.length > 0) {
                    allTabs[0].classList.add('active');
                    allTabs[0].setAttribute('aria-selected', 'true');
                }
                var originalTab = document.getElementById('ac-originalTab');
                if (originalTab) {
                    originalTab.classList.add('active');
                }
                
                announceToScreenReader('Tool reset. Ready for new billboard analysis.');
                
                document.querySelector('.adcorrector-tool').scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (error) {
                console.error('Reset error:', error);
                window.location.reload();
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        return {
            analyzeAd: analyzeAd,
            resetTool: resetTool,
            switchTab: switchTab,
            downloadReport: downloadReport,
            exportJSONData: exportJSONData
        };
    })();

function acHasUsableTextInImage(ocrText) {
    if (!ocrText) return false;

    var cleaned = ocrText
        .replace(/\s+/g, " ")
        .replace(/[^\w\s.,!?'"-]/g, "")
        .trim();

    if (cleaned.length < 10) return false;

    var letterCount = (cleaned.match(/[A-Za-z]/g) || []).length;
    var symbolCount = (cleaned.match(/[^A-Za-z0-9\s]/g) || []).length;

    if (letterCount / cleaned.length < 0.5) return false;
    if (symbolCount / cleaned.length > 0.3) return false;

    return true;
}

    function acAnalyzeAd() { AdCorrector.analyzeAd(); }
    function acResetTool() { AdCorrector.resetTool(); }
    function acSwitchTab(tab) { AdCorrector.switchTab(tab); }
    function acDownloadReport() { AdCorrector.downloadReport(); }
    function acExportJSONData() { AdCorrector.exportJSONData(); }

(function () {
  var note = document.querySelector('.ac-best-results-note');
  if (!note) return;

  var fields = [
    document.getElementById('ac-headlineText'),
    document.getElementById('ac-ctaText'),
    document.getElementById('ac-bodyText')
  ];

  // remove nulls (no .filter(Boolean) for max compatibility)
  var cleanedFields = [];
  for (var i = 0; i < fields.length; i++) {
    if (fields[i]) cleanedFields.push(fields[i]);
  }
  if (!cleanedFields.length) return;

  for (var j = 0; j < cleanedFields.length; j++) {
    (function (field) {
      field.addEventListener('focus', function () {
        note.classList.add('ac-note-active');
      });

      field.addEventListener('blur', function () {
        note.classList.remove('ac-note-active');
      });
    })(cleanedFields[j]);
  }
})();

/* === BUDGET EFFICACY SIMULATOR LOGIC === */

function acToggleEfficacyPanel() {
    var panel = document.getElementById('ac-efficacy-panel');
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        acCalculateEfficacy(); // Run calc immediately to catch existing input
        setTimeout(function() {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } else {
        panel.style.display = 'none';
    }
}

function acToggleEfficacyModal() {
    var modal = document.getElementById('ac-efficacy-modal');
    if (modal.style.display === 'none' || modal.style.display === '') {
        modal.style.display = 'block';
    } else {
        modal.style.display = 'none';
    }
}

function acCalculateEfficacy() {
    // Rely on the global physics scores generated in Step 1
    if (!window.acLastScores) return;

    var budgetInput = document.getElementById('ac-eff-budget').value;
    var decInput = document.getElementById('ac-eff-dec').value;
    var resultBox = document.getElementById('ac-efficacy-results');
    
    var investment = parseFloat(budgetInput);
    var dec = parseFloat(decInput);

    // Only show results if a valid budget is entered
    if (isNaN(investment) || investment <= 0) {
        resultBox.style.display = 'none';
        return;
    }

    // 1. Sync Efficacy with the Active Campaign Mode Score
    if (!window.acLastDetails || typeof window.acLastDetails.avgScore !== 'number') return;
    var rawEfficacy = window.acLastDetails.avgScore;
    
    // 2. Apply Safety Floor (Never report less than 35% efficacy)
    var efficacyScore = Math.max(35, Math.round(rawEfficacy));
    
    // 3. Calculate Financial Delta
    var impactGap = investment * (1 - (efficacyScore / 100));
    
    // 4. Update UI
    document.getElementById('ac-eff-score-val').textContent = efficacyScore + '%';
    
    var formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    });
    document.getElementById('ac-eff-gap-val').textContent = formatter.format(impactGap);
    
    // If they entered a DEC, show a directional visibility-efficiency estimate.
    var decLossEl = document.getElementById('ac-eff-dec-loss');
    if (!isNaN(dec) && dec > 0) {
        var lostDec = Math.round(dec * (1 - (efficacyScore / 100)));
        decLossEl.textContent = '~' + lostDec.toLocaleString() + ' impressions may be underutilized';
        decLossEl.style.display = 'block';
    } else {
        decLossEl.style.display = 'none';
    }

    resultBox.style.display = 'grid';
}

// Bind real-time calculation listeners when the document loads
document.addEventListener('DOMContentLoaded', function() {
    var budgetEl = document.getElementById('ac-eff-budget');
    var decEl = document.getElementById('ac-eff-dec');
    
    if (budgetEl) budgetEl.addEventListener('input', acCalculateEfficacy);
    if (decEl) decEl.addEventListener('input', acCalculateEfficacy);
});

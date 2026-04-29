function get(name) {
    if (name = (new RegExp('[?&]' + encodeURIComponent(name) + '=([^&]*)')).exec(location.search))
        return decodeURIComponent(name[1]);
}

function getDecoded(name) {
    const encoded = get(name)
    if (!encoded) {
        console.warn(`Parameter '${name}' is empty`)
        return null
    }
    try {
        // Decode URL-safe base64 to standard base64
        const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
        // Decode base64 to binary string
        const binary = atob(base64)
        // Convert binary string to UTF-8 using TextDecoder
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        const decoder = new TextDecoder('utf-8')
        const utf8Decoded = decoder.decode(bytes)
        // The content was also URL-encoded before base64, so decode it
        return decodeURIComponent(utf8Decoded)
    } catch (e) {
        console.error(`Failed to decode parameter '${name}':`, e.message)
        console.error('Encoded value:', encoded ? encoded.substring(0, 100) + '...' : 'null')
        return null
    }
}

let dir = get("d")
if (dir === "1") {
    document.body.classList.add("rtl")
} else if (dir === "2") {
    document.body.classList.add("vertical")
    document.body.addEventListener("wheel", (evt) => {
        document.scrollingElement.scrollLeft -= evt.deltaY;
    });
}
/**
 * Smart main content extraction algorithm
 * Uses text density and content density scoring to find the main content area
 * Based on the Readability algorithm approach
 * @param {Document} doc - Parsed HTML document
 * @returns {string} - Extracted main content HTML
 */
function extractMainContent(doc) {
    console.log('[SmartExtract] Starting smart content extraction...')

    // Score all elements in the document
    const candidates = []

    // Score elements based on text density and content density
    const allElements = doc.body.querySelectorAll('*')

    allElements.forEach(element => {
        const textContent = element.textContent || ''
        const textLength = textContent.trim().length

        // Skip elements with very little text
        if (textLength < 200) return

        // Skip leaf elements (P, H1-H6, SPAN, etc.) - we want containers
        const leafTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'li', 'td', 'th', 'a', 'strong', 'em', 'b', 'i']
        if (leafTags.includes(element.tagName.toLowerCase())) return

        // Calculate text density
        const htmlLength = element.innerHTML.length
        const textRatio = textLength / Math.max(htmlLength, 1)

        // Calculate content density (links ratio)
        const links = element.querySelectorAll('a')
        const linksTextLength = Array.from(links).reduce((sum, link) =>
            sum + (link.textContent || '').length, 0
        )
        const linksRatio = linksTextLength / Math.max(textLength, 1)

        // Count child elements (bonus for containers with multiple children)
        const childCount = element.children.length
        const childBonus = Math.min(childCount * 0.5, 10) // Max 10 points bonus

        // Calculate score
        // High text ratio is good, high links ratio is bad (likely navigation)
        let score = textRatio * 100

        // Bonus for having multiple child elements (container)
        score += childBonus

        // Penalize elements with many links (likely navigation/menu)
        if (linksRatio > 0.3) {
            score *= (1 - linksRatio)
        }

        // Bonus for semantic HTML elements
        if (element.tagName === 'ARTICLE' || element.tagName === 'MAIN') {
            score *= 1.5
        }

        // Bonus for common content class names
        const className = element.className || ''
        if (typeof className === 'string') {
            if (className.includes('content') ||
                className.includes('article') ||
                className.includes('post') ||
                className.includes('story') ||
                className.includes('announcement') ||
                className.includes('release') ||
                className.includes('middle-content')) {
                score *= 1.3
            }

            // Penalize navigation/header/footer
            if (className.includes('nav') ||
                className.includes('menu') ||
                className.includes('header') ||
                className.includes('footer') ||
                className.includes('sidebar')) {
                score *= 0.5
            }
        }

        candidates.push({
            element,
            score,
            textLength,
            linksRatio,
            childCount
        })
    })

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score)

    // Log top candidates for debugging
    console.log('[SmartExtract] Top 5 candidates:')
    candidates.slice(0, 5).forEach((candidate, index) => {
        const tagName = candidate.element.tagName
        const className = candidate.element.className || ''
        console.log(`  ${index + 1}. ${tagName}.${className.substring(0, 30)} - score: ${candidate.score.toFixed(2)}, text: ${candidate.textLength} chars, children: ${candidate.childCount}, links ratio: ${candidate.linksRatio.toFixed(2)}`)
    })

    // Return the best candidate's HTML
    if (candidates.length > 0 && candidates[0].score > 10) {
        const bestCandidate = candidates[0]
        console.log(`[SmartExtract] Selected: ${bestCandidate.element.tagName} with score ${bestCandidate.score.toFixed(2)}`)

        // Clean up the selected element
        const content = bestCandidate.element.cloneNode(true)

        // Remove any remaining unwanted elements
        content.querySelectorAll('script, style, noscript, iframe, nav, footer, header').forEach(el => el.remove())

        // Remove empty elements
        content.querySelectorAll('*').forEach(el => {
            if (!el.textContent.trim() && el.children.length === 0) {
                el.remove()
            }
        })

        return content.innerHTML
    }

    // Fallback to body if no good candidate found
    console.log('[SmartExtract] No good candidate found, using body')
    return doc.body.innerHTML
}

/**
 * Fallback content extraction function
 * Used when Mercury Parser fails or extracts too little content
 * @param {string} html - Raw HTML content
 * @returns {string} - Extracted article content
 */
function extractContentFallback(html) {
    console.log('[Fallback] Starting content extraction...')

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Remove unwanted elements
    const unwantedSelectors = [
        'script', 'style', 'noscript', 'iframe',
        'svg', 'canvas', 'nav', 'footer', 'header',
        '.ad', '.ads', '.advertisement', '.sidebar',
        '.nav', '.navigation', '.menu', '.breadcrumb',
        '.share', '.social', '.comments', '.comment',
        '.related', '.recommended', '.newsletter',
        '#ad', '#ads', '#sidebar', '#nav', '#footer', '#header'
    ]

    unwantedSelectors.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => el.remove())
    })

    // Try to find main content container
    const contentSelectors = [
        'article',
        '[role="main"]',
        '.post-content', '.article-content', '.entry-content',
        '.content', '.main-content', '.article-body',
        '.post-body', '.story-body', '.article-text',
        '#content', '#main', '#article', '#post',
        '.container > .row > .col',
        'main',
        // Add selectors for press release/announcement pages
        '.announcement--content', '.press-release', '.news-content',
        '.pr-content', '.release-content', '.announcement-body'
    ]

    let contentElement = null
    let bestContentLength = 0
    
    // Try all selectors and pick the one with most content
    for (const selector of contentSelectors) {
        const element = doc.querySelector(selector)
        if (element) {
            const textLength = element.innerText ? element.innerText.length : 0
            console.log(`[Fallback] Selector "${selector}" found, text length: ${textLength}`)
            if (textLength > bestContentLength) {
                contentElement = element
                bestContentLength = textLength
                console.log(`[Fallback] New best content with selector: ${selector}, length: ${textLength}`)
            }
        }
    }

    // If no specific container found or content is too small, use body
    if (!contentElement || bestContentLength < 500) {
        contentElement = doc.body
        console.log('[Fallback] Using body as content container, text length:', contentElement.innerText.length)
    }

    // Clean up attributes and empty elements
    contentElement.querySelectorAll('*').forEach(el => {
        // Remove elements with very small text content (likely ads/widgets)
        const text = el.innerText || ''
        if (text.length < 10 && text.trim().length < 5) {
            const childCount = el.children.length
            if (childCount === 0) {
                el.remove()
            }
        }
    })

    // Get the cleaned HTML
    let content = contentElement.innerHTML

    console.log(`[Fallback] Extracted content length: ${content.length}`)
    return content
}

async function getArticle(url) {
    let article = getDecoded("a")
    console.log('getDecoded("a"):', article ? article.substring(0, 100) + '...' : 'null')

    // If in Tauri iframe mode (m=1), wait for postMessage with full content
    if (get("m") === "1") {
        console.log('[Article] Mode m=1 detected, waiting for postMessage with full content...')
        
        // First, notify the parent window that we're ready to receive content
        window.parent.postMessage({ type: 'articleReady' }, '*')
        
        return new Promise((resolve) => {
            let received = false
            window.addEventListener('message', async (event) => {
                if (event.data && event.data.type === 'fullContent' && !received) {
                    received = true
                    console.log('[Article] Received full content via postMessage, length:', event.data.html.length)
                    const { html, url: msgUrl, loadFull } = event.data

                    let articleContent = html
                    if (loadFull) {
                        console.log('[Article] Running Mercury Parser on content...')
                        let extractionAttempts = 0
                        const originalHtmlLength = html.length

                        // Try Mercury Parser first
                        try {
                            const result = await Mercury.parse(msgUrl || url, { html: articleContent })
                            articleContent = result.content || articleContent
                            extractionAttempts++
                            console.log(`[Article] Mercury Parser extraction attempt ${extractionAttempts}, length:`, articleContent.length)
                        } catch (e) {
                            console.error('[Article] Mercury Parser failed:', e)
                        }

                        // If Mercury extracted significantly less content than original, or very little content, try fallback
                        // Use relative threshold: if extracted content is less than 50% of original or less than 1000 chars
                        const isExtractionInsufficient = articleContent.length < 1000 || 
                            articleContent.length < originalHtmlLength * 0.5
                        
                        if (isExtractionInsufficient) {
                            console.log(`[Article] Mercury extraction insufficient (${articleContent.length} vs original ${originalHtmlLength}), trying fallback...`)
                            articleContent = extractContentFallback(html)
                            extractionAttempts++
                            console.log(`[Article] Fallback extraction attempt ${extractionAttempts}, length:`, articleContent.length)
                        }

                        // If still too little content, use smart content extraction
                        // Check both absolute threshold and relative threshold
                        const isStillInsufficient = articleContent.length < 1000 ||
                            articleContent.length < originalHtmlLength * 0.3

                        if (isStillInsufficient) {
                            console.log('[Article] Fallback insufficient, using smart content extraction...')
                            console.log('[Article] Original HTML length:', html.length)

                            // Clean up the original HTML by removing script/style tags
                            const parser = new DOMParser()
                            const doc = parser.parseFromString(html, 'text/html')

                            // Remove unwanted elements
                            const unwantedSelectors = [
                                'script', 'style', 'noscript', 'iframe',
                                'nav', 'header', 'footer',
                                '.nav', '.navigation', '.menu', '.breadcrumb',
                                '.sidebar', '.side-menu', '.main-nav',
                                '.ad', '.ads', '.advertisement',
                                '.share', '.social', '.comments',
                                '.related', '.recommended', '.newsletter',
                                '#nav', '#header', '#footer', '#sidebar'
                            ]
                            unwantedSelectors.forEach(selector => {
                                doc.querySelectorAll(selector).forEach(el => el.remove())
                            })

                            // Use greedy content extraction algorithm
                            // Find the element with highest text density
                            articleContent = extractMainContent(doc)

                            extractionAttempts++
                            console.log(`[Article] Smart extraction attempt ${extractionAttempts}, length:`, articleContent.length)
                        }

                        // If final content is still too short, notify parent to load URL directly
                        if (articleContent.length < 1000) {
                            console.log('[Article] Content still too short after all attempts, requesting direct URL load...')
                            window.parent.postMessage({
                                type: 'requestDirectLoad',
                                url: msgUrl || url
                            }, '*')
                            // Return empty content to indicate failure
                            resolve('')
                            return
                        }

                        console.log('[Article] Final content length:', articleContent.length)
                    }

                    resolve(articleContent)
                }
            })
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (!received) {
                    console.warn('[Article] Timeout waiting for postMessage, using fallback')
                    resolve(article || '')
                }
            }, 5000)
        })
    }

    // Fallback: use decoded content from URL parameter (non-Tauri mode)
    if (article) {
        if (get("m") === "1") {
            return (await Mercury.parse(url, {html: article})).content || ""
        } else {
            return article
        }
    }

    console.warn('[Article] No content available')
    return ""
}
document.documentElement.style.fontSize = get("s") + "px"
let font = get("f")
if (font) document.body.style.fontFamily = `"${font}"`
let url = get("u")
console.log('URL:', url)
getArticle(url).then(article => {
    console.log('Article content:', article ? article.substring(0, 100) + '...' : 'null')
    let domParser = new DOMParser()
    const htmlContent = getDecoded("h")
    console.log('getDecoded("h"):', htmlContent ? htmlContent.substring(0, 100) + '...' : 'null')
    let dom = domParser.parseFromString(htmlContent || '<article></article>', "text/html")
    let articleEl = dom.getElementsByTagName("article")[0]
    if (!articleEl) {
        articleEl = dom.createElement('article')
        dom.body.appendChild(articleEl)
    }
    articleEl.innerHTML = article
    let baseEl = dom.createElement('base')
    baseEl.setAttribute('href', url.split("/").slice(0, 3).join("/"))
    dom.head.append(baseEl)
    for (let s of dom.getElementsByTagName("script")) {
        s.parentNode.removeChild(s)
    }
    for (let e of dom.querySelectorAll("*[src]")) {
        e.src = e.src
    }
    for (let e of dom.querySelectorAll("*[href]")) {
        e.href = e.href
    }
    let main = document.getElementById("main")
    console.log('Main element:', main)
    console.log('Setting innerHTML:', dom.body.innerHTML.substring(0, 100) + '...')
    main.innerHTML = dom.body.innerHTML
    main.classList.add("show")
    console.log('Article display complete')

    let itemId = parseInt(get("itemId"));

    function getPathTo(element) {
        if (element.id !== '')
            return 'id("' + element.id + '")';
        if (element === document.body)
            return element.tagName;

        let ix = 0;
        let siblings = element.parentNode.childNodes;
        for (let i = 0; i < siblings.length; i++) {
            let sibling = siblings[i];
            if (sibling === element)
                return getPathTo(element.parentNode) + '/' + element.tagName + '[' + (ix + 1) + ']';
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
                ix++;
        }
    }

    function serializeRange(range) {
        let start = {
            path: getPathTo(range.startContainer),
            offset: range.startOffset
        };
        let end = {
            path: getPathTo(range.endContainer),
            offset: range.endOffset
        };
        return JSON.stringify({ start, end });
    }

    function deserializeRange(serializedRange) {
        let savedRange = JSON.parse(serializedRange);
        let startNode = document.evaluate(savedRange.start.path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        let endNode = document.evaluate(savedRange.end.path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        let range = document.createRange();
        range.setStart(startNode, savedRange.start.offset);
        range.setEnd(endNode, savedRange.end.offset);
        return range;
    }

    function highlightRange(range) {
        let mark = document.createElement("mark");
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
    }

    let highlightBtn = document.getElementById("highlight-btn");
    let currentRange = null;

    document.addEventListener("mouseup", (e) => {
        let selection = window.getSelection();
        if (selection.isCollapsed) {
            highlightBtn.style.display = "none";
            currentRange = null;
            return;
        }
        currentRange = selection.getRangeAt(0);
        let rect = currentRange.getBoundingClientRect();
        highlightBtn.style.top = (rect.top + window.scrollY - highlightBtn.offsetHeight - 5) + "px";
        highlightBtn.style.left = (rect.left + window.scrollX + rect.width / 2 - highlightBtn.offsetWidth / 2) + "px";
        highlightBtn.style.display = "block";
    });

    document.addEventListener("mousedown", (e) => {
        if (e.target !== highlightBtn) {
            highlightBtn.style.display = "none";
        }
    });

    highlightBtn.addEventListener("click", () => {
        if (currentRange) {
            let text = currentRange.toString();
            let range = serializeRange(currentRange);
            window.utils.createHighlight(itemId, text, range);
            highlightRange(currentRange);
            currentRange = null;
            highlightBtn.style.display = "none";
        }
    });

    let highlights = JSON.parse(get("hl") || "[]");
    for (let hl of highlights) {
        try {
            let range = deserializeRange(hl.range);
            highlightRange(range);
        } catch (e) {
            console.error("Failed to highlight:", hl, e);
        }
    }
})

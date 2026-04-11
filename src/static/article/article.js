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
        'main'
    ]
    
    let contentElement = null
    for (const selector of contentSelectors) {
        contentElement = doc.querySelector(selector)
        if (contentElement && contentElement.innerText.length > 100) {
            console.log(`[Fallback] Found content with selector: ${selector}`)
            break
        }
        contentElement = null
    }
    
    // If no specific container found, use body
    if (!contentElement) {
        contentElement = doc.body
        console.log('[Fallback] Using body as content container')
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
                        
                        // Try Mercury Parser first
                        try {
                            const result = await Mercury.parse(msgUrl || url, { html: articleContent })
                            articleContent = result.content || articleContent
                            extractionAttempts++
                            console.log(`[Article] Mercury Parser extraction attempt ${extractionAttempts}, length:`, articleContent.length)
                        } catch (e) {
                            console.error('[Article] Mercury Parser failed:', e)
                        }

                        // If Mercury extracted very little content, try fallback
                        if (articleContent.length < 200) {
                            console.log('[Article] Mercury extraction returned too little content, trying fallback...')
                            articleContent = extractContentFallback(html)
                            extractionAttempts++
                            console.log(`[Article] Fallback extraction attempt ${extractionAttempts}, length:`, articleContent.length)
                        }

                        // If still too little content, the page likely requires JS rendering
                        // Since the iframe's DOM only has article.html structure (not the actual content),
                        // we should just use the original HTML directly
                        if (articleContent.length < 200) {
                            console.log('[Article] All extraction methods failed, using original HTML directly...')
                            console.log('[Article] Original HTML length:', html.length)
                            
                            // Clean up the original HTML by removing script/style tags
                            const parser = new DOMParser()
                            const doc = parser.parseFromString(html, 'text/html')
                            
                            // Remove script and style tags
                            doc.querySelectorAll('script, style, noscript').forEach(el => el.remove())
                            
                            // Try to find content containers in the original HTML
                            const contentSelectors = [
                                'article',
                                '[role="main"]',
                                '.post-content', '.article-content', '.entry-content',
                                '.content', '.main-content', '.article-body',
                                '.post', '.story', '.article-text',
                                '#content', '#main-content', '#article', '#post',
                                '.et_pb_post', '.wp-block-post-content',
                                'main'
                            ]
                            
                            let contentElement = null
                            for (const selector of contentSelectors) {
                                contentElement = doc.querySelector(selector)
                                if (contentElement) {
                                    const text = contentElement.innerText || ''
                                    if (text.length > 50) {
                                        console.log(`[Article] Found content container: ${selector}`)
                                        articleContent = contentElement.innerHTML
                                        break
                                    }
                                }
                            }
                            
                            // If still no good content, use the entire body
                            if (articleContent.length < 200) {
                                console.log('[Article] Using entire body as content')
                                articleContent = doc.body.innerHTML
                            }
                            
                            extractionAttempts++
                            console.log(`[Article] Final extraction attempt ${extractionAttempts}, length:`, articleContent.length)
                        }

                        // If final content is still too short, notify parent to load URL directly
                        if (articleContent.length < 200) {
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

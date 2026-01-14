function get(name) {
    if (name = (new RegExp('[?&]' + encodeURIComponent(name) + '=([^&]*)')).exec(location.search))
        return decodeURIComponent(name[1]);
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
async function getArticle(url) {
    let article = get("a")
    if (get("m") === "1") {
        return (await Mercury.parse(url, {html: article})).content || ""
    } else {
        return article
    }
}
document.documentElement.style.fontSize = get("s") + "px"
let font = get("f")
if (font) document.body.style.fontFamily = `"${font}"`
let url = get("u")
getArticle(url).then(article => {
    let domParser = new DOMParser()
    let dom = domParser.parseFromString(get("h"), "text/html")
    dom.getElementsByTagName("article")[0].innerHTML = article
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
    main.innerHTML = dom.body.innerHTML
    main.classList.add("show")

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

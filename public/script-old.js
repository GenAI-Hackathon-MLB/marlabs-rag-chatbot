(function () {
  // // ----- Session Setup -----
  // let sessionId = sessionStorage.getItem('chatSessionId')
  // if (!sessionId) {
  //   sessionId =
  //     'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
  //   sessionStorage.setItem('chatSessionId', sessionId)
  // }

  // ----- Build Chat UI Elements -----
  const chatContainer = document.createElement('div')
  chatContainer.id = 'chatContainer'
  chatContainer.style.display = 'none'
  chatContainer.style.flexDirection = 'column'

  const chatHeader = document.createElement('div')
  chatHeader.id = 'chatHeader'
  chatHeader.style.display = 'flex'
  chatHeader.style.flexDirection = 'row'

  const chatTitle = document.createElement('div')
  chatTitle.id = 'chatTitle'
  chatTitle.textContent = 'MarsAI Chatbot'
  chatHeader.appendChild(chatTitle)
  const typingIndicator = document.createElement('div')
  typingIndicator.id = 'typingIndicator'
  typingIndicator.textContent = 'Typing...'
  chatHeader.appendChild(typingIndicator)
  chatContainer.appendChild(chatHeader)

  const chatMessages = document.createElement('div')
  chatMessages.id = 'chatMessages'
  chatMessages.style.display = 'flex'
  chatMessages.style.flexDirection = 'column'
  chatContainer.appendChild(chatMessages)

  const chatInputArea = document.createElement('div')
  chatInputArea.id = 'chatInputArea'
  const chatInput = document.createElement('input')
  chatInput.id = 'chatInput'
  chatInput.type = 'text'
  chatInput.placeholder = 'Type your message...'
  chatInputArea.appendChild(chatInput)
  const chatSendBtn = document.createElement('button')
  chatSendBtn.id = 'chatSendBtn'
  chatSendBtn.textContent = 'Send'
  chatInputArea.appendChild(chatSendBtn)
  chatContainer.appendChild(chatInputArea)

  document.body.appendChild(chatContainer)

  const chatToggle = document.createElement('div')
  chatToggle.id = 'chatToggle'
  chatToggle.textContent = '💬'
  document.body.appendChild(chatToggle)

  // ----- Toggle Chat Window -----
  chatToggle.addEventListener('click', () => {
    chatContainer.style.display =
      chatContainer.style.display === 'none' ? 'flex' : 'none'
  })

  // ----- Utility Functions -----
  function appendMessage(messageId, message, sender = 'bot', updating = false) {
    let bubble
    console.log(messageId, sender, updating)
    if (sender == 'user') {
      updating = false
    }
    if (updating) {
      bubble = document.getElementById(messageId)
      if (bubble) {
        bubble.innerHTML += message
      } else {
        bubble = document.createElement('div')
        bubble.id = messageId
        bubble.className = `chat-bubble ${sender}`
        bubble.innerHTML = message
        chatMessages.appendChild(bubble)
      }
      chatMessages.scrollTop = chatMessages.scrollHeight
    } else {
      bubble = document.createElement('div')
      bubble.id = messageId
      bubble.className = `chat-bubble ${sender}`
      bubble.innerHTML = message
      chatMessages.appendChild(bubble)
      chatMessages.scrollTop = chatMessages.scrollHeight
    }
  }

  function showTypingIndicator() {
    typingIndicator.style.height = 'auto'
    chatSendBtn.disabled = true
    chatInput.disabled = true
  }
  function hideTypingIndicator() {
    typingIndicator.style.height = '0px'
    chatSendBtn.disabled = false
    chatInput.disabled = false
  }

  // API call supporting both streaming and non-streaming responses.
  async function fetchChatResponse(userMessage) {
    const id = Date.now()
    showTypingIndicator()
    const response = await fetch('./chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    })
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let result = ''

    while (true) {
      const chunk = await reader.read()
      const { done, value } = chunk
      if (done) break

      // Decode the chunk and append it to your result or update your UI
      let decodedChunk = decoder.decode(value)

      // For example, update the UI with the new text:
      console.log('Received chunk:', decodedChunk)
      appendMessage(id, decodedChunk, 'bot', true)
    }
    //convert links to a tag
    let message  = document.getElementById(id)
    message.innerHTML = convertMarkdownToHTML(message.innerHTML)
    
    hideTypingIndicator()
  }

  // ----- Convert Markdown to HTML ------
  function convertMarkdownToHTML(markdown) {
    // Convert headers: lines starting with one to six '#' characters
    markdown = markdown.replace(/^###### (.*$)/gm, "<h6>$1</h6>");
    markdown = markdown.replace(/^##### (.*$)/gm, "<h5>$1</h5>");
    markdown = markdown.replace(/^#### (.*$)/gm, "<h4>$1</h4>");
    markdown = markdown.replace(/^### (.*$)/gm, "<h3>$1</h3>");
    markdown = markdown.replace(/^## (.*$)/gm, "<h2>$1</h2>");
    markdown = markdown.replace(/^# (.*$)/gm, "<h1>$1</h1>");
    
    // Convert bold text: **text**
    markdown = markdown.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    
    // Convert italic text: *text*
    markdown = markdown.replace(/\*(.+?)\*/g, "<em>$1</em>");
    
    // Convert line breaks to <br> tags (optional)
    markdown = markdown.replace(/\n/g, "<br>");

    // Links to a tag
    // const linkRegex = /(https?\:\/\/)?(www\.)?[^\s]+\.[^\s]+/g
    const linkRegex = /https?:\/\/[^\s)]+/g;
    
    markdown = markdown.replace(linkRegex, function(matched) {
      let withProtocol = matched
    
      const newStr = `<a
          class="job-link"
          href="${withProtocol}"
          target="_blank"
        >Link</a>
      `
    
      return newStr
    })
    
    return markdown;
  }

  // ----- Message Sending Logic -----
  async function sendMessage() {
    const message = chatInput.value.trim()
    if (!message) return
    const id = Date.now()
    appendMessage(id, message, 'user')
    chatInput.value = ''
    await fetchChatResponse(message)
  }

  chatSendBtn.addEventListener('click', sendMessage)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  })
})()

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatHistory {
  messages: Message[];
}

export class RAGChat {
  private history: ChatHistory;
  
  constructor() {
    this.history = { messages: [] };
  }

  async streamResponse(prompt: string): Promise<ReadableStream> {
    this.history.messages.push({
      role: 'user',
      content: prompt
    });

    // Create a transform stream for handling chunks
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Simulate streaming response
    const encoder = new TextEncoder();
    const response = "This is a sample streaming response...";
    
    // Write response chunk by chunk
    for (const chunk of response.split(' ')) {
      await writer.write(encoder.encode(chunk + ' '));
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
    }

    await writer.close();
    
    // Add assistant response to history
    this.history.messages.push({
      role: 'assistant',
      content: response
    });

    return stream.readable;
  }

  getHistory(): ChatHistory {
    return this.history;
  }

  clearHistory(): void {
    this.history.messages = [];
  }
}
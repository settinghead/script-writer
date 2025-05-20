# Collaborative Script Editor Implementation Plan

## Overview

This document outlines the plan to transform the current chat tab into a collaborative script editing interface, featuring a chat panel on the left (30%) and a Slate-based script editor on the right (70%).

## Architecture

### Core Components

1. **Chat Panel**
   - Modified version of existing ChatTab component
   - Maintains AI conversation history
   - Sends user messages to backend

2. **Script Editor**
   - Slate.js-based rich text editor
   - Custom node types for script formatting
   - Real-time collaborative editing via YJS

3. **Synchronization Layer**
   - YJS backend with WebSocket transport
   - LLM output parser to convert AI responses to YJS edit commands
   - Bidirectional sync between editor state and YJS document

## Implementation Steps

### Phase 1: Environment Setup

1. **Add Dependencies**
   ```bash
   npm install slate slate-react slate-history @slate-yjs/core @slate-yjs/react yjs y-websocket ws @types/ws @types/slate @types/slate-react react-resizable @types/react-resizable
   ```

2. **Update TypeScript Configurations**
   - Ensure proper type support for Slate and YJS

### Phase 2: Basic Editor Component

1. **Create Script Editor Component**
   ```tsx
   // src/client/components/ScriptEditor.tsx
   import React, { useMemo, useState } from 'react';
   import { createEditor } from 'slate';
   import { Slate, Editable, withReact } from 'slate-react';
   import { withHistory } from 'slate-history';
   
   const initialValue = [{ type: 'paragraph', children: [{ text: '' }] }];
   
   const ScriptEditor = () => {
     const editor = useMemo(() => withHistory(withReact(createEditor())), []);
     const [value, setValue] = useState(initialValue);
     
     return (
       <div className="script-editor">
         <Slate editor={editor} value={value} onChange={setValue}>
           <Editable />
         </Slate>
       </div>
     );
   };
   
   export default ScriptEditor;
   ```

2. **Create Editor Toolbar Component**
   ```tsx
   // src/client/components/EditorToolbar.tsx
   import React from 'react';
   import { Button, Tooltip } from 'antd';
   import { BoldOutlined, ItalicOutlined, UnderlineOutlined } from '@ant-design/icons';
   
   const EditorToolbar = ({ editor }) => {
     // Format handlers will go here
     
     return (
       <div className="editor-toolbar">
         <Tooltip title="Bold">
           <Button icon={<BoldOutlined />} />
         </Tooltip>
         <Tooltip title="Italic">
           <Button icon={<ItalicOutlined />} />
         </Tooltip>
         <Tooltip title="Underline">
           <Button icon={<UnderlineOutlined />} />
         </Tooltip>
         {/* Add more formatting options */}
       </div>
     );
   };
   
   export default EditorToolbar;
   ```

### Phase 3: Redesign ChatTab Component

1. **Create Resizable Layout**
   ```tsx
   // src/client/components/ScriptTab.tsx
   import React, { useState } from 'react';
   import { ResizableBox } from 'react-resizable';
   import 'react-resizable/css/styles.css';
   import ChatPanel from './ChatPanel'; // Extracted from ChatTab
   import CollaborativeEditor from './CollaborativeEditor';
   
   const ScriptTab = () => {
     return (
       <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 100px)' }}>
         <ResizableBox
           width={300} // 30% of typical 1000px width
           height={Infinity}
           minConstraints={[200, Infinity]}
           maxConstraints={[500, Infinity]}
           resizeHandles={['e']}
           className="chat-panel-wrapper"
         >
           <ChatPanel />
         </ResizableBox>
         <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
           <CollaborativeEditor roomId="default-script-room" />
         </div>
       </div>
     );
   };
   
   export default ScriptTab;
   ```

2. **Extract Chat Panel from ChatTab**
   - Preserve existing chat functionality
   - Make UI more compact to fit in 30% space
   - Modify to send messages to both chat API and script editing API

### Phase 4: YJS Integration

1. **Create Collaborative Editor Component**
   ```tsx
   // src/client/components/CollaborativeEditor.tsx
   import React, { useEffect, useMemo, useState } from 'react';
   import { createEditor, Editor, Transforms } from 'slate';
   import { Slate, Editable, withReact } from 'slate-react';
   import { withYjs, YjsEditor } from '@slate-yjs/core';
   import * as Y from 'yjs';
   import { WebsocketProvider } from 'y-websocket';
   import EditorToolbar from './EditorToolbar';
   import { Cursors } from './Cursors';
   
   const initialValue = [{ type: 'paragraph', children: [{ text: '' }] }];
   
   const CollaborativeEditor = ({ roomId }) => {
     const [connected, setConnected] = useState(false);
     const [sharedType, setSharedType] = useState(null);
     const [provider, setProvider] = useState(null);
   
     // Set up your Yjs document and provider
     useEffect(() => {
       const yDoc = new Y.Doc();
       const sharedDoc = yDoc.get('slate', Y.XmlText);
   
       // Connect to WebSocket provider
       const yProvider = new WebsocketProvider(
         `ws://${window.location.host}/yjs`, 
         `script-${roomId}`,
         yDoc
       );
   
       yProvider.on('sync', isSynced => {
         console.log('Synchronized with peers:', isSynced);
         setConnected(true);
       });
   
       setSharedType(sharedDoc);
       setProvider(yProvider);
   
       return () => {
         yDoc?.destroy();
         yProvider?.off('sync', setConnected);
         yProvider?.destroy();
       };
     }, [roomId]);
   
     if (!connected || !sharedType || !provider) {
       return <div>Connecting to collaborative session...</div>;
     }
   
     return <SlateEditor sharedType={sharedType} provider={provider} />;
   };
   
   const SlateEditor = ({ sharedType, provider }) => {
     const editor = useMemo(() => {
       // Create editor with Yjs and cursor support
       const e = withReact(
         withYjs(createEditor(), sharedType)
       );
   
       // Ensure editor always has at least 1 valid child
       const { normalizeNode } = e;
       e.normalizeNode = entry => {
         const [node] = entry;
   
         if (!Editor.isEditor(node) || node.children.length > 0) {
           return normalizeNode(entry);
         }
   
         Transforms.insertNodes(e, initialValue, { at: [0] });
       };
   
       return e;
     }, [sharedType]);
   
     // Connect/disconnect editor when component mounts/unmounts
     useEffect(() => {
       YjsEditor.connect(editor);
       return () => YjsEditor.disconnect(editor);
     }, [editor]);
   
     return (
       <div className="slate-editor-container">
         <EditorToolbar editor={editor} />
         <Slate editor={editor} initialValue={initialValue}>
           <Editable className="editor-content" />
         </Slate>
       </div>
     );
   };
   
   export default CollaborativeEditor;
   ```

2. **Add Remote Cursors Support**
   ```tsx
   // src/client/components/Cursors.tsx
   import React, { useRef } from 'react';
   import {
     CursorOverlayData,
     useRemoteCursorOverlayPositions,
   } from '@slate-yjs/react';
   
   export function Cursors({ children }) {
     const containerRef = useRef(null);
     const [cursors] = useRemoteCursorOverlayPositions({ containerRef });
   
     return (
       <div className="cursors" ref={containerRef}>
         {children}
         {cursors.map(cursor => (
           <Selection key={cursor.clientId} {...cursor} />
         ))}
       </div>
     );
   }
   
   function Selection({ data, selectionRects, caretPosition }) {
     if (!data) {
       return null;
     }
   
     const selectionStyle = {
       backgroundColor: data.color,
     };
   
     return (
       <>
         {selectionRects.map((position, i) => (
           <div
             style={{ ...selectionStyle, ...position }}
             className="selection"
             key={i}
           />
         ))}
         {caretPosition && <Caret caretPosition={caretPosition} data={data} />}
       </>
     );
   }
   
   function Caret({ caretPosition, data }) {
     const caretStyle = {
       ...caretPosition,
       background: data?.color,
     };
   
     const labelStyle = {
       transform: 'translateY(-100%)',
       background: data?.color,
     };
   
     return (
       <div style={caretStyle} className="caretMarker">
         <div className="caret" style={labelStyle}>
           {data?.name}
         </div>
       </div>
     );
   }
   ```

3. **Add Cursor Styles**
   ```css
   /* src/client/cursor-styles.css */
   .cursors {
     position: relative;
   }
   
   .caretMarker {
     position: absolute;
     width: 2px;
   }
   
   .caret {
     position: absolute;
     font-size: 14px;
     color: #fff;
     white-space: nowrap;
     top: 0;
     border-radius: 6px;
     border-bottom-left-radius: 0;
     padding: 2px 6px;
     pointer-events: none;
   }
   
   .selection {
     position: absolute;
     pointer-events: none;
     opacity: 0.2;
   }
   ```

4. **Integrate Cursors with Editor**
   ```tsx
   // Update SlateEditor in CollaborativeEditor.tsx
   const SlateEditor = ({ sharedType, provider }) => {
     const editor = useMemo(() => {
       // Create editor with Yjs and cursor support
       const e = withReact(
         withCursors(
           withYjs(createEditor(), sharedType),
           provider.awareness,
           {
             // The current user's cursor data
             data: {
               name: 'User',
               color: '#1890ff', // Match the theme color
             },
           }
         )
       );
   
       // Ensure editor always has at least 1 valid child
       const { normalizeNode } = e;
       e.normalizeNode = entry => {
         const [node] = entry;
   
         if (!Editor.isEditor(node) || node.children.length > 0) {
           return normalizeNode(entry);
         }
   
         Transforms.insertNodes(e, initialValue, { at: [0] });
       };
   
       return e;
     }, [sharedType, provider]);
   
     // Connect/disconnect editor when component mounts/unmounts
     useEffect(() => {
       YjsEditor.connect(editor);
       return () => YjsEditor.disconnect(editor);
     }, [editor]);
   
     return (
       <div className="slate-editor-container">
         <EditorToolbar editor={editor} />
         <Slate editor={editor} initialValue={initialValue}>
           <Cursors>
             <Editable className="editor-content" />
           </Cursors>
         </Slate>
       </div>
     );
   };
   ```

### Phase 5: Custom Node Types

1. **Define Script-Specific Node Types**
   ```typescript
   // src/client/types/slate.d.ts
   import { BaseEditor } from 'slate';
   import { ReactEditor } from 'slate-react';
   import { HistoryEditor } from 'slate-history';
   
   export type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;
   
   export type ParagraphElement = {
     type: 'paragraph';
     children: CustomText[];
   };
   
   export type SceneHeadingElement = {
     type: 'scene-heading';
     children: CustomText[];
   };
   
   export type CharacterElement = {
     type: 'character';
     children: CustomText[];
   };
   
   export type DialogueElement = {
     type: 'dialogue';
     children: CustomText[];
   };
   
   export type CustomElement = 
     | ParagraphElement
     | SceneHeadingElement
     | CharacterElement
     | DialogueElement;
   
   export type FormattedText = {
     text: string;
     bold?: boolean;
     italic?: boolean;
     underline?: boolean;
   };
   
   export type CustomText = FormattedText;
   
   declare module 'slate' {
     interface CustomTypes {
       Editor: CustomEditor;
       Element: CustomElement;
       Text: CustomText;
     }
   }
   ```

2. **Implement Custom Rendering for Node Types**
   ```tsx
   // src/client/components/ScriptElements.tsx
   import React from 'react';
   import { RenderElementProps, RenderLeafProps } from 'slate-react';
   
   export const Element = ({ attributes, children, element }: RenderElementProps) => {
     switch (element.type) {
       case 'scene-heading':
         return <div {...attributes} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{children}</div>;
       case 'character':
         return <div {...attributes} style={{ textAlign: 'center', textTransform: 'uppercase' }}>{children}</div>;
       case 'dialogue':
         return <div {...attributes} style={{ marginLeft: '20%', marginRight: '20%' }}>{children}</div>;
       default:
         return <p {...attributes}>{children}</p>;
     }
   };
   
   export const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
     let style: React.CSSProperties = {};
     
     if (leaf.bold) style.fontWeight = 'bold';
     if (leaf.italic) style.fontStyle = 'italic';
     if (leaf.underline) style.textDecoration = 'underline';
     
     return <span {...attributes} style={style}>{children}</span>;
   };
   ```

### Phase 6: Backend Integration

1. **Set Up WebSocket Server for YJS**
   ```typescript
   // src/server/yjs-server.ts
   import * as Y from 'yjs';
   import { Server as HttpServer } from 'http';
   import WebSocket from 'ws';
   import { setupWSConnection } from 'y-websocket/bin/utils';
   
   interface Document {
     id: string;
     ydoc: Y.Doc;
   }
   
   // In-memory document store (should be replaced with a database in production)
   const documents = new Map<string, Document>();
   
   export const setupYjsWebSocketServer = (httpServer: HttpServer) => {
     const wss = new WebSocket.Server({ noServer: true });
     
     wss.on('connection', (ws, req, roomName) => {
       // Create or get the document for this room
       if (!documents.has(roomName)) {
         const ydoc = new Y.Doc();
         documents.set(roomName, { id: roomName, ydoc });
       }
       
       const document = documents.get(roomName)!;
       
       // Set up Y.js WebSocket connection
       setupWSConnection(ws, req, { 
         docName: roomName,
         gc: true 
       });
     });
     
     // Handle the upgrade
     httpServer.on('upgrade', (request, socket, head) => {
       const url = new URL(request.url!, `http://${request.headers.host}`);
       const pathname = url.pathname;
       
       if (pathname.startsWith('/yjs')) {
         const roomName = pathname.slice(5); // Remove '/yjs/' prefix
         
         wss.handleUpgrade(request, socket, head, (ws) => {
           wss.emit('connection', ws, request, roomName);
         });
       }
     });
     
     return wss;
   };
   
   // Function to get the Y.Doc for a room
   export const getYDoc = (roomId: string): Y.Doc | null => {
     const document = documents.get(roomId);
     return document ? document.ydoc : null;
   };
   
   // Function to apply LLM-generated edits to a Y.Doc
   export const applyEditsToYDoc = (
     roomId: string, 
     edits: Array<{ position: number, insert?: string, delete?: number }>
   ): boolean => {
     const document = documents.get(roomId);
     if (!document) return false;
     
     const { ydoc } = document;
     const ytext = ydoc.getText('content');
     
     // Apply the edits as a single transaction
     ydoc.transact(() => {
       // Sort edits in reverse order to avoid position shifts
       const sortedEdits = [...edits].sort((a, b) => b.position - a.position);
       
       for (const edit of sortedEdits) {
         if (edit.delete && edit.delete > 0) {
           ytext.delete(edit.position, edit.delete);
         }
         if (edit.insert) {
           ytext.insert(edit.position, edit.insert);
         }
       }
     });
     
     return true;
   };
   ```

2. **Integrate YJS Server with Express**
   ```typescript
   // Modify src/server/index.ts to include YJS
   import express from "express";
   import ViteExpress from "vite-express";
   import { createOpenAI } from '@ai-sdk/openai';
   import { streamText } from 'ai';
   import dotenv from 'dotenv';
   import http from 'http';
   import { setupYjsWebSocketServer, applyEditsToYDoc } from './yjs-server';
   import { parseLLMResponse } from './llm-to-yjs';
   
   dotenv.config();
   
   const PORT = parseInt(process.env.PORT || "4600");
   const app = express();
   const server = http.createServer(app);
   
   app.use(express.json()); // Middleware to parse JSON bodies
   
   // Set up YJS WebSocket server
   const yjs = setupYjsWebSocketServer(server);
   
   // Original message endpoint
   app.get("/message", (_req, res) => {
     res.send("Hello from Express!");
   });
   
   // Original chat completions endpoint
   app.post("/llm-api/chat/completions", async (req: any, res: any) => {
     // ... existing implementation ...
   });
   
   // New endpoint for script editing using LLM
   app.post("/llm-api/script/edit", async (req: any, res: any) => {
     const apiKey = process.env.DEEPSEEK_API_KEY;
     if (!apiKey) {
       console.error('Error: DEEPSEEK_API_KEY environment variable is not set.');
       return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured" });
     }
   
     const { 
       messages, 
       model: modelName, 
       roomId,
       context,
       ...restOfBody 
     } = req.body;
   
     if (!messages || !modelName || !roomId) {
       return res.status(400).json({ 
         error: "Missing 'messages', 'model', or 'roomId' in request body" 
       });
     }
   
     const deepseekAI = createOpenAI({
       apiKey: apiKey,
       baseURL: 'https://api.deepseek.com',
     });
   
     try {
       // Add system message instructing the LLM how to format script editing responses
       const systemMessage = {
         role: 'system',
         content: `You are a script writing assistant. Your responses should be formatted for direct integration
                  with a collaborative script editor. When making edits to the script, use the following format:
                  
                  {
                    "edits": [
                      { "position": 123, "insert": "Text to insert" },
                      { "position": 456, "delete": 10 }
                    ],
                    "explanation": "Why I made these changes"
                  }
                  
                  You'll be provided with the current state of the script in the context field.`
       };
       
       // Modify messages to include system prompt and script context
       const enhancedMessages = [
         systemMessage, 
         ...messages
       ];
       
       // If context is provided, add it to the last message
       if (context && enhancedMessages.length > 0) {
         const lastMessageIndex = enhancedMessages.length - 1;
         const lastMessage = enhancedMessages[lastMessageIndex];
         enhancedMessages[lastMessageIndex] = {
           ...lastMessage,
           content: `${lastMessage.content}\n\nCurrent script:\n${context}`
         };
       }
   
       // Request formatted specifically for script edits
       const result = await streamText({
         model: deepseekAI(modelName),
         messages: enhancedMessages,
         response_format: { type: "json_object" },
         ...restOfBody
       });
   
       // Set up headers for streaming response
       res.setHeader('Content-Type', 'text/plain; charset=utf-8');
       res.setHeader('Transfer-Encoding', 'chunked');
   
       const reader = result.toDataStream().getReader();
       let fullResponse = '';
   
       function pump() {
         reader.read().then(({ done, value }) => {
           if (done) {
             // Process the complete response to extract edit commands
             try {
               const edits = parseLLMResponse(fullResponse);
               if (edits && edits.length > 0) {
                 // Apply edits to the YJS document
                 applyEditsToYDoc(roomId, edits);
               }
             } catch (err) {
               console.error('Error parsing or applying LLM edits:', err);
             }
             
             res.end();
             return;
           }
           
           const chunk = new TextDecoder().decode(value);
           fullResponse += chunk;
           res.write(chunk);
           pump();
         }).catch(err => {
           console.error("Error during stream pump:", err);
           if (!res.writableEnded) {
             res.status(500).end("Stream error");
           }
         });
       }
       
       pump();
   
     } catch (error: any) {
       console.error('Error in /llm-api/script/edit endpoint:', error);
       if (!res.headersSent) {
         if (error.response) {
           return res.status(error.response.status).json(error.response.data);
         } else if (error.status && error.error) {
           return res.status(error.status).json(error.error);
         }
         return res.status(500).json({ error: "Failed to process script edit request", details: error.message });
       }
       
       if (!res.writableEnded) {
         console.error("Headers sent, but error occurred. Ending response.");
         res.end();
       }
     }
   });
   
   // Script document management endpoints
   app.post("/api/scripts", (req, res) => {
     // Create a new script document
     // Return room ID for collaborative editing
   });
   
   app.get("/api/scripts/:id", (req, res) => {
     // Get script document by ID
   });
   
   // Use server instead of app for WebSocket support
   ViteExpress.listen(server, PORT, () => {
     console.log(`Server is listening on http://localhost:${PORT}`);
   });
   ```

3. **Implement LLM Response Parser**
   ```typescript
   // src/server/llm-to-yjs.ts
   interface EditOperation {
     position: number;
     insert?: string;
     delete?: number;
   }
   
   interface LLMEditResponse {
     edits: EditOperation[];
     explanation?: string;
   }
   
   export const parseLLMResponse = (response: string): EditOperation[] => {
     try {
       // Clean up the response string if needed
       const cleanedResponse = response.trim();
       
       // Try to extract JSON from the response
       const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
       if (!jsonMatch) {
         throw new Error('No valid JSON found in response');
       }
       
       const jsonStr = jsonMatch[0];
       const parsed: LLMEditResponse = JSON.parse(jsonStr);
       
       if (!parsed.edits || !Array.isArray(parsed.edits)) {
         throw new Error('Invalid edits format');
       }
       
       // Validate each edit operation
       return parsed.edits.filter(edit => {
         // Position must be a number
         if (typeof edit.position !== 'number') return false;
         
         // Must have either insert or delete
         if (edit.insert === undefined && edit.delete === undefined) return false;
         
         // If has delete, it must be a positive number
         if (edit.delete !== undefined && (typeof edit.delete !== 'number' || edit.delete <= 0)) return false;
         
         // If has insert, it must be a string
         if (edit.insert !== undefined && typeof edit.insert !== 'string') return false;
         
         return true;
       });
     } catch (err) {
       console.error('Error parsing LLM response:', err);
       return [];
     }
   };
   ```

### Phase 7: UI Refinement

1. **Add Style and Layout**
   - Apply Ant Design styling
   - Implement responsive layout
   - Add editor focus styles

2. **Implement Keyboard Shortcuts**
   - Add standard formatting shortcuts (Ctrl+B, Ctrl+I, etc.)
   - Add script-specific shortcuts

## Dependencies

- **Core Editor**:
  - slate
  - slate-react
  - slate-history

- **Collaboration**:
  - @slate-yjs/core
  - @slate-yjs/react
  - yjs
  - y-websocket

- **UI Components**:
  - antd (already in project)
  - react-resizable (for resizable panels)

- **Backend**:
  - ws (WebSocket server)
  - y-websocket (YJS WebSocket utilities)

## Timeline Estimates

1. **Environment Setup**: 1 day
2. **Basic Editor Component**: 2-3 days
3. **Redesign Chat Tab**: 2 days
4. **YJS Integration**: 2-3 days
5. **Custom Node Types**: 2 days
6. **Backend Integration**: 3-4 days
7. **UI Refinement**: 2-3 days

Total estimated time: 2-3 weeks for initial implementation, plus additional time for testing and refinement.

## Future Enhancements

1. **Advanced Formatting**
   - Script-specific formatting rules
   - Auto-formatting based on context

2. **AI Integration**
   - Highlight text to get AI suggestions
   - Special commands for scene generation, dialogue improvement, etc.

3. **Version History**
   - Implement YJS history tracking
   - Provide UI for browsing and restoring previous versions

4. **Export Options**
   - Export to industry-standard formats (Final Draft, etc.)
   - PDF generation with proper screenplay formatting

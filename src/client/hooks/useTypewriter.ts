import { useState, useEffect, useRef } from 'react';

interface UseTypewriterOptions {
    speed?: number; // milliseconds per character
    onComplete?: () => void;
}

export const useTypewriter = (options: UseTypewriterOptions = {}) => {
    const { speed = 50, onComplete } = options;
    const [displayText, setDisplayText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const targetTextRef = useRef('');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const startTyping = (text: string) => {
        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        targetTextRef.current = text;
        setDisplayText('');
        setIsTyping(true);

        let currentIndex = 0;

        const typeNextCharacter = () => {
            if (currentIndex < text.length) {
                setDisplayText(text.slice(0, currentIndex + 1));
                currentIndex++;
                timeoutRef.current = setTimeout(typeNextCharacter, speed);
            } else {
                setIsTyping(false);
                onComplete?.();
            }
        };

        // Start typing after a small delay
        timeoutRef.current = setTimeout(typeNextCharacter, speed);
    };

    const stopTyping = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsTyping(false);
        // Complete the text immediately
        setDisplayText(targetTextRef.current);
    };

    const resetTypewriter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setDisplayText('');
        setIsTyping(false);
        targetTextRef.current = '';
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        displayText,
        isTyping,
        startTyping,
        stopTyping,
        resetTypewriter
    };
}; 
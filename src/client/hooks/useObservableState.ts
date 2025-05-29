import { useEffect, useState } from 'react';
import { Observable } from 'rxjs';

export function useObservableState<T>(
    observable: Observable<T> | undefined,
    initialValue: T
): T {
    const [state, setState] = useState<T>(initialValue);

    useEffect(() => {
        if (!observable) {
            // If observable is undefined, just keep the initial value
            return;
        }

        const subscription = observable.subscribe({
            next: (value) => setState(value),
            error: (error) => {
                // Error is handled by the observable itself
            }
        });

        return () => subscription.unsubscribe();
    }, [observable]);

    return state;
} 
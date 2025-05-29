import { useEffect, useState } from 'react';
import { Observable } from 'rxjs';

export function useObservableState<T>(
    observable: Observable<T>,
    initialValue: T
): T {
    const [state, setState] = useState<T>(initialValue);

    useEffect(() => {
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
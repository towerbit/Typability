import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import { toastJotai } from '../../jotais/ui';
import styles from './toast.module.scss';

const Toast: React.FC = () => {
    const [toast, setToast] = useAtom(toastJotai);

    useEffect(() => {
        if (!toast) return;

        const timer = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(timer);
    }, [toast, setToast]);

    if (!toast) return null;

    return (
        <div className={styles.wrapper} role="status">
            <div className={toast.kind === 'error' ? `${styles.toast} ${styles.error}` : styles.toast}>
                {toast.text}
            </div>
        </div>
    );
};

export default Toast;

import styles from './Button.module.css';

export default function Button({ children, onClick, variant = 'primary', type = 'button' }) {
  const className = variant === 'secondary' ? styles.secondary : styles.primary;

  return (
    <button type={type} className={className} onClick={onClick}>
      {children}
    </button>
  );
}

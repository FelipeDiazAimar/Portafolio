import styles from './Card.module.css';

export default function Card({ title, children }) {
  return (
    <div className={styles.card}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}

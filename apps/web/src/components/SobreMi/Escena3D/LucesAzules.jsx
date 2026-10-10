// Rig de luces de la serie: ambiente tenue, luz clave azul y contraluz cian.
// Los valores son un punto de partida: ajustar a ojo en el navegador.
export default function LucesAzules() {
  return (
    <>
      <ambientLight intensity={0.8} color="#9db8ff" />
      <directionalLight position={[3, 4, 3]} intensity={3.4} color="#6f9bff" />
      <pointLight position={[-3.5, 1.2, -2.5]} intensity={45} distance={14} color="#3de0ff" />
      <pointLight position={[2.5, -1, 3]} intensity={18} distance={10} color="#5b8cff" />
    </>
  );
}

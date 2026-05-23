export default function GoogleSignInError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      className="text-center mt-2 px-2"
      style={{ fontSize: "13px", color: "#EF4444", lineHeight: 1.45 }}
      role="alert"
    >
      {message}
    </p>
  );
}

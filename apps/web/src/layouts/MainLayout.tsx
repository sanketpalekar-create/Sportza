import { useState } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import { RoleBadge, RoleSwitchModal } from "../components/RoleSwitcher";

export default function MainLayout() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <div className="max-w-md mx-auto bg-[#0F172A] min-h-screen">

        {/* Badge row — reserved top space prevents overlap with page headers */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "12px 16px 0",
          }}
        >
          <RoleBadge onPress={() => setShowModal(true)} />
        </div>

        <main
          className="relative"
          style={{ paddingBottom: "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom))" }}
        >
          <Outlet />
        </main>

        <BottomNav />

        {showModal && <RoleSwitchModal onClose={() => setShowModal(false)} />}
      </div>
    </div>
  );
}

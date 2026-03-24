import { useNavigate } from "react-router-dom";
import { LogOut, Clock, ShieldCheck } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function PendingApproval() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-[#FDFDFF] flex items-center justify-center p-6 font-['Inter']">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-indigo-100 rounded-[2rem] rotate-6 animate-pulse" />
                    <div className="absolute inset-0 bg-white rounded-[2rem] border-2 border-indigo-50 shadow-xl flex items-center justify-center -rotate-3 transition-transform hover:rotate-0 duration-500 group">
                        <Clock className="w-10 h-10 text-indigo-600 group-hover:scale-110 transition-transform" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl font-[900] text-gray-900 uppercase tracking-tighter">Account Pending</h1>
                    <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-50 rounded-full w-fit mx-auto border border-amber-100">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Awaiting Activation</span>
                    </div>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-[280px] mx-auto">
                        Your account has been created successfully. For security, a **Super Admin** needs to activate your profile before you can access the dashboard.
                    </p>
                </div>

                <div className="pt-4 space-y-4">
                    <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50 italic">
                        <p className="text-[11px] text-indigo-600 font-bold uppercase tracking-wider">
                            An administrator will be notified of your request.
                        </p>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full py-4 bg-white border-2 border-gray-100 rounded-2xl text-gray-400 font-black uppercase tracking-widest text-xs hover:bg-gray-50 hover:text-gray-600 hover:border-gray-200 transition-all flex items-center justify-center gap-2 group"
                    >
                        <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Return to Login
                    </button>
                </div>

                <div className="flex flex-col items-center opacity-40">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] leading-none mb-1">easyid</span>
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-[0.2em]">
                        Institution ID Management System
                    </p>
                </div>
            </div>
        </div>
    );
}

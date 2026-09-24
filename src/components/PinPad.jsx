import { useState, useEffect } from 'react';
import { Lock, Delete, Fingerprint } from 'lucide-react';
import { supabase } from '../lib/supabase'; 

const PinPad = ({ mode = 'unlock', dbPin, onUnlock, onSetup, onSkip }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(mode === 'setup' ? 'create' : 'enter'); // 'create', 'confirm', 'enter'
  const [error, setError] = useState(null);

  const PIN_LENGTH = 6;

  // Simple hash function for security (SHA-256)
  const hashPin = async (rawPin) => {
    const msgUint8 = new TextEncoder().encode(rawPin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    const processPin = async () => {
      if (pin.length === PIN_LENGTH) {
        if (step === 'create') {
          setTimeout(() => {
            setConfirmPin(pin);
            setPin('');
            setStep('confirm');
          }, 300);
        } else if (step === 'confirm') {
          if (pin === confirmPin) {
            const hashed = await hashPin(pin);
            onSetup(hashed); // Pass hash back to App.jsx to save in DB
          } else {
            setError('PIN tidak cocok. Ulangi kembali.');
            setPin('');
            setConfirmPin('');
            setStep('create');
            setTimeout(() => setError(null), 3000);
          }
        } else if (step === 'enter') {
          const hashedInput = await hashPin(pin);
          if (hashedInput === dbPin) { // Compare with DB Pin instead of localStorage
            // Save to localStorage just to remember this device is unlocked
            localStorage.setItem('device_unlocked', 'true'); 
            onUnlock();
          } else {
            setError('PIN Salah!');
            setPin('');
            setTimeout(() => setError(null), 2000);
          }
        }
      }
    };
    processPin();
  }, [pin, step, confirmPin, onSetup, onUnlock, dbPin]);

  const handleKeyPress = (num) => {
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const renderDots = () => {
    const dots = [];
    for (let i = 0; i < PIN_LENGTH; i++) {
      dots.push(
        <div 
          key={i} 
          className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length ? 'bg-blue-600 scale-110' : 'bg-gray-200'}`}
        />
      );
    }
    return dots;
  };

  const padNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-10 duration-300">
      <div className="flex flex-col items-center w-full max-w-sm">
        
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-100">
           {step === 'enter' ? <Lock size={32} /> : <Fingerprint size={32} />}
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">
          {step === 'create' && 'Buat PIN Aplikasi'}
          {step === 'confirm' && 'Konfirmasi PIN'}
          {step === 'enter' && 'Masukkan PIN'}
        </h2>
        <p className="text-gray-500 text-sm font-medium mb-10 text-center">
          {step === 'create' && 'Buat Master PIN untuk aplikasi ini.'}
          {step === 'confirm' && 'Masukkan kembali PIN yang baru saja dibuat.'}
          {step === 'enter' && 'Buka kunci aplikasi KAsir.'}
        </p>

        <div className="flex gap-4 mb-12 justify-center h-4">
          {renderDots()}
        </div>

        {error && (
          <div className="text-red-500 text-sm font-bold absolute top-10 bg-red-50 px-4 py-2 rounded-full animate-in fade-in">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 w-full max-w-[280px]">
          {padNumbers.map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="w-full aspect-square bg-gray-50 rounded-2xl text-2xl font-bold text-gray-800 hover:bg-gray-100 active:bg-blue-100 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-gray-100"
            >
              {num}
            </button>
          ))}
          <div className="w-full aspect-square"></div> {/* Empty space */}
          <button
            onClick={() => handleKeyPress('0')}
            className="w-full aspect-square bg-gray-50 rounded-2xl text-2xl font-bold text-gray-800 hover:bg-gray-100 active:bg-blue-100 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-gray-100"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-full aspect-square bg-red-50/50 rounded-2xl text-red-500 hover:bg-red-50 active:bg-red-100 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-red-50"
          >
            <Delete size={28} />
          </button>
        </div>
        
        {mode === 'setup' && onSkip && (
          <button 
            type="button"
            onClick={onSkip}
            className="mt-8 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-5 py-2.5 rounded-xl transition-all shadow-sm border border-blue-100 active:scale-95"
          >
            Lewati (Masuk Tanpa PIN)
          </button>
        )}

        {step === 'enter' && (
          <button 
            onClick={async () => {
              localStorage.removeItem('device_unlocked');
              localStorage.removeItem('kasir_user');
              try {
                await supabase.auth.signOut();
              } catch (e) {
                console.warn('Signout note:', e);
              }
              window.location.reload();
            }} 
            className="mt-12 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
          >
            Keluar (Logout)
          </button>
        )}
      </div>
    </div>
  );
};

export default PinPad;

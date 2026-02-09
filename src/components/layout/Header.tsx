'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  LogOut, 
  Settings, 
  Wallet, 
  Bell,
  Menu,
  X
} from 'lucide-react';

const Header: React.FC = () => {
  const { user, logout, activeBalance, accountType } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  if (!user) return null;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-blue-600">
                BinaryTrade
              </h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${accountType === 'demo' ? 'bg-blue-50' : 'bg-green-50'}`}>
                <Wallet className={`w-5 h-5 ${accountType === 'demo' ? 'text-blue-600' : 'text-green-600'}`} />
                <span className="text-sm font-medium text-gray-700">{accountType === 'demo' ? 'Demo:' : 'Saldo:'}</span>
                <span className={`text-lg font-bold ${accountType === 'demo' ? 'text-blue-600' : 'text-green-600'}`}>
                  R$ {activeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                <Bell className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  3
                </span>
              </button>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="hidden lg:block text-left">
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <Settings className="w-4 h-4 mr-3" />
                    Configurações
                  </button>
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <Wallet className="w-4 h-4 mr-3" />
                    Carteira
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={logout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50">
              <div className="flex items-center space-x-3 px-3 py-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg mx-3 ${accountType === 'demo' ? 'bg-blue-50' : 'bg-green-50'}`}>
                <Wallet className={`w-5 h-5 ${accountType === 'demo' ? 'text-blue-600' : 'text-green-600'}`} />
                <span className="text-sm font-medium text-gray-700">{accountType === 'demo' ? 'Demo:' : 'Saldo:'}</span>
                <span className={`text-lg font-bold ${accountType === 'demo' ? 'text-blue-600' : 'text-green-600'}`}>
                  R$ {activeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              <button
                onClick={logout}
                className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sair
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

const APP_NAME = 'Cromia';
const isPortalSubdomain = () =>
  typeof window !== 'undefined' && /^portal\./i.test(window.location.hostname);

const formatTitle = (page: string) => `${page} | ${APP_NAME}`;

const resolveHubTitle = (search: string) => {
  const tab = new URLSearchParams(search).get('tab');

  if (tab === 'approvals') return formatTitle('Central Operacional');
  if (tab === 'requests') return formatTitle('Solicitações do Cliente');
  return formatTitle('Central Operacional');
};

const resolveRouteTitle = (pathname: string, search: string) => {
  if (pathname === '/' || pathname === '') return formatTitle('Painel Operacional');
  if (pathname === '/login') return formatTitle('Login');
  if (pathname === '/dashboard') return formatTitle('Painel Operacional');
  if (pathname === '/boards') return formatTitle('Quadro Operacional');
  if (pathname === '/clients') return formatTitle('Clientes');
  if (matchPath('/clients/:id', pathname)) return formatTitle('Hub do Cliente');
  if (pathname === '/posting-calendar') return formatTitle('Calendário Editorial');
  if (pathname === '/posting-calendar/template') return formatTitle('Modelo Editorial');
  if (pathname === '/hub') return resolveHubTitle(search);
  if (pathname === '/portal/solicitar') return formatTitle('Nova Solicitação');
  if (pathname === '/onboarding') return formatTitle('Onboarding');
  if (pathname === '/team') return formatTitle('Gestão de Equipe');
  if (pathname === '/finance') return formatTitle('Financeiro');
  if (pathname === '/drive') return formatTitle('Drive de Arquivos');
  if (pathname === '/documents') return formatTitle('Documentos');
  if (matchPath('/documents/:id/edit', pathname)) return formatTitle('Editor de Documento');
  if (pathname === '/settings') return formatTitle('Configurações');
  if (pathname === '/logs') return formatTitle('Logs do Sistema');
  if (pathname === '/whatsapp') return formatTitle('WhatsApp');
  if (matchPath('/portal/:slug', pathname)) return formatTitle('Portal do Cliente');
  if (isPortalSubdomain() && matchPath('/:slug', pathname)) return formatTitle('Portal do Cliente');
  if (matchPath('/portal/aprovacao/:slug', pathname) || matchPath('/cliente/aprovacao/:slug', pathname)) {
    return formatTitle('Aprovação do Cliente');
  }
  if (isPortalSubdomain() && matchPath('/aprovacao/:slug', pathname)) return formatTitle('Aprovação do Cliente');
  return APP_NAME;
};

export const RouteTitleManager = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = resolveRouteTitle(location.pathname, location.search);
  }, [location.pathname, location.search]);

  return null;
};

export default RouteTitleManager;

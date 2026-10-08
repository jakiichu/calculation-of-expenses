import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BudgetApp } from './BudgetApp';
import { createServices } from './create-services';
import { initializeOffline } from './offline';
import './styles.css';

const services = createServices();
const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing');

createRoot(root).render(
  <StrictMode>
    <BudgetApp service={services.budget} />
  </StrictMode>,
);
void initializeOffline();

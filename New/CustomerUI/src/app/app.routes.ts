import { Routes } from '@angular/router';
import { CustomerLoginComponent } from './features/auth/customer-login/customer-login.component';
import { CustomerMarketplaceComponent } from './features/customer/marketplace/customer-marketplace.component';
import { TokenDetailComponent } from './features/customer/token-detail/token-detail.component';
import { HomeComponent } from './features/home/home.component';
import { CartComponent } from './features/customer/cart/cart.component';
import { CheckoutComponent } from './features/customer/checkout/checkout.component';
import { PaymentReturnComponent } from './features/customer/payment-return/payment-return.component';

export const appRoutes: Routes = [
  { path: '',               component: HomeComponent },
  { path: 'login',          component: CustomerLoginComponent },
  { path: 'marketplace',    component: CustomerMarketplaceComponent },
  { path: 'cart',           component: CartComponent },
  { path: 'checkout',       component: CheckoutComponent },
  { path: 'payment/return', component: PaymentReturnComponent },
  { path: 'token/:id',      component: TokenDetailComponent },
  { path: '**',             redirectTo: '' }
];

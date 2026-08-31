import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { LoginComponent } from './login';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);

    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('redirige ADMIN a /dashboard/admin', () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (component as any).redirigir('admin');

    expect(spy).toHaveBeenCalledWith(['/dashboard/admin']);
  });

  it('redirige SUPERADMIN al mismo /dashboard/admin', () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (component as any).redirigir('superadmin');

    expect(spy).toHaveBeenCalledWith(['/dashboard/admin']);
  });

  it('rol desconocido vuelve a /login', () => {
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (component as any).redirigir('rol-invalido');

    expect(spy).toHaveBeenCalledWith(['/login']);
  });
});

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsuarioService, UsuarioRegistro } from '../../services/usuario.service';
import { AreaService, Area } from '../../services/area.service';
import { UsuarioInfo } from '../../services/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SidebarComponent],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.scss'
})
export class GestionUsuariosComponent implements OnInit {
  usuarios: UsuarioInfo[] = [];
  areas: Area[] = [];
  usuariosForm!: FormGroup;
  credenciales: UsuarioRegistro | null = null;
  mensaje = '';
  error = '';
  cargando = false;

  private usuarioService = inject(UsuarioService);
  private areaService = inject(AreaService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  readonly roles = [
    { valor: 'ROLE_DEPARTAMENTO', etiqueta: 'Departamento' },
    { valor: 'ROLE_COORDINACION', etiqueta: 'Coordinación' },
    { valor: 'ROLE_DIRECCION', etiqueta: 'Dirección' },
    { valor: 'ROLE_DIRECCION_GENERAL', etiqueta: 'Dirección General' },
    { valor: 'ROLE_MATERIALES', etiqueta: 'Materiales' }
  ];

  get esMateriales(): boolean {
    return this.usuariosForm.get('rol')?.value === 'ROLE_MATERIALES';
  }

  ngOnInit(): void {
    this.usuariosForm = this.fb.group({
      nombreCompleto: ['', Validators.required],
      rol: ['ROLE_DEPARTAMENTO', Validators.required],
      areaId: [null as number | null]
    });
    this.usuariosForm.get('rol')!.valueChanges.subscribe((rol) => {
      if (rol === 'ROLE_MATERIALES') {
        this.usuariosForm.patchValue({ areaId: null });
      }
    });
    this.cargar();
    this.cargarAreas();
  }

  cargar(): void {
    this.cargando = true;
    this.cdr.markForCheck();
    this.usuarioService.listar().subscribe({
      next: (data) => {
        this.usuarios = data;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar los usuarios. Revisa que el backend esté activo.';
        this.cargando = false;
        this.cdr.markForCheck();
      }
    });
  }

  cargarAreas(): void {
    this.areaService.listar().subscribe({
      next: (data) => {
        this.areas = data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar las áreas.';
        this.cdr.markForCheck();
      }
    });
  }

  crear(): void {
    if (this.usuariosForm.get('nombreCompleto')!.invalid || !this.usuariosForm.get('rol')!.value) {
      this.error = 'Completa el nombre completo y el rol.';
      this.cdr.markForCheck();
      return;
    }
    if (!this.esMateriales && !this.usuariosForm.get('areaId')!.value) {
      this.error = 'Selecciona el área del organigrama para este usuario.';
      this.cdr.markForCheck();
      return;
    }
    this.error = '';
    this.mensaje = '';
    this.credenciales = null;
    this.usuarioService.crear(this.usuariosForm.value).subscribe({
      next: (res) => {
        this.credenciales = res;
        this.mensaje = 'Usuario creado correctamente. Entrega estas credenciales al nuevo usuario.';
        this.usuariosForm.reset({ rol: 'ROLE_DEPARTAMENTO' });
        this.cargar();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo crear el usuario.';
        this.cdr.markForCheck();
      }
    });
  }

  toggleActivo(u: UsuarioInfo): void {
    const nuevoEstado = !u.activo;
    this.usuarioService.cambiarEstado(u.id, nuevoEstado).subscribe({
      next: () => {
        u.activo = nuevoEstado;
        this.mensaje = `Usuario ${nuevoEstado ? 'activado' : 'desactivado'}.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo cambiar el estado.';
        this.cdr.markForCheck();
      }
    });
  }
}
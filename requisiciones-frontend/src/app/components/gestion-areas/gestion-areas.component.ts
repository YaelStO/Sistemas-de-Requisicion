import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AreaService, Area } from '../../services/area.service';

@Component({
  selector: 'app-gestion-areas',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SidebarComponent],
  templateUrl: './gestion-areas.component.html',
  styleUrl: './gestion-areas.component.scss'
})
export class GestionAreasComponent implements OnInit {
  areas: Area[] = [];
  areasForm!: FormGroup;
  editandoId: number | null = null;
  mensaje = '';
  error = '';
  cargando = false;

  readonly niveles = [
    { valor: 'DEPARTAMENTO', etiqueta: 'Departamento' },
    { valor: 'COORDINACION', etiqueta: 'Coordinación' },
    { valor: 'DIRECCION', etiqueta: 'Dirección' },
    { valor: 'DIRECCION_GENERAL', etiqueta: 'Dirección General' }
  ];

  private areaService = inject(AreaService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.areasForm = this.fb.group({
      nombre: ['', Validators.required],
      nivel: ['DEPARTAMENTO', Validators.required],
      parentId: [null as number | null]
    });
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.cdr.markForCheck();
    this.areaService.listar().subscribe({
      next: (data) => {
        this.areas = data;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar las áreas. Revisa que el backend esté activo.';
        this.cargando = false;
        this.cdr.markForCheck();
      }
    });
  }

  guardar(): void {
    if (this.areasForm.invalid) {
      this.error = 'Completa el nombre y el nivel del área.';
      this.cdr.markForCheck();
      return;
    }
    this.error = '';
    this.mensaje = '';
    const body = this.areasForm.value;
    if (this.editandoId != null) {
      this.areaService.actualizar(this.editandoId, body).subscribe({
        next: () => {
          this.mensaje = 'Área actualizada correctamente.';
          this.resetForm();
          this.cargar();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = typeof err.error === 'string' ? err.error : 'No se pudo actualizar el área.';
          this.cdr.markForCheck();
        }
      });
    } else {
      this.areaService.crear(body).subscribe({
        next: () => {
          this.mensaje = 'Área creada correctamente en el organigrama.';
          this.resetForm();
          this.cargar();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = typeof err.error === 'string' ? err.error : 'No se pudo crear el área.';
          this.cdr.markForCheck();
        }
      });
    }
  }

  editar(a: Area): void {
    this.editandoId = a.id;
    this.areasForm.patchValue({ nombre: a.nombre, nivel: a.nivel, parentId: a.parentId });
    this.cdr.markForCheck();
  }

  resetForm(): void {
    this.editandoId = null;
    this.areasForm.reset({ nivel: 'DEPARTAMENTO', parentId: null });
    this.cdr.markForCheck();
  }

  toggleActivo(a: Area): void {
    const nuevoEstado = !a.activo;
    this.areaService.cambiarEstado(a.id, nuevoEstado).subscribe({
      next: () => {
        a.activo = nuevoEstado;
        this.mensaje = `Área ${nuevoEstado ? 'activada' : 'desactivada'}.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo cambiar el estado.';
        this.cdr.markForCheck();
      }
    });
  }

  eliminar(a: Area): void {
    const confirmado = window.confirm(
      `¿Eliminar el área "${a.nombre}"? Se eliminarán también todos los usuarios asignados a ella.`
    );
    if (!confirmado) {
      return;
    }
    this.error = '';
    this.mensaje = '';
    this.areaService.eliminar(a.id).subscribe({
      next: () => {
        this.mensaje = `Área "${a.nombre}" eliminada junto con sus usuarios.`;
        if (this.editandoId === a.id) {
          this.resetForm();
        }
        this.cargar();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo eliminar el área.';
        this.cdr.markForCheck();
      }
    });
  }
}
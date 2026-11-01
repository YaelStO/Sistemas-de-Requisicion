import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Directive({
  selector: '[appIntegerInput]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IntegerInputDirective),
      multi: true
    }
  ]
})
export class IntegerInputDirective implements ControlValueAccessor {
  private valor: number | null = null;
  private onTouched: () => void = () => {};
  private onChange: (v: number | null) => void = () => {};

  constructor(private el: ElementRef<HTMLInputElement>) {
    this.el.nativeElement.inputMode = 'numeric';
    this.el.nativeElement.type = 'text';
    this.el.nativeElement.autocomplete = 'off';
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;
    if (!/\d/.test(event.key)) {
      event.preventDefault();
    }
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const original = input.value;
    const limpio = original.replace(/\D/g, '');

    if (limpio !== original) {
      const posicion = input.selectionStart ?? limpio.length;
      const eliminados = original.length - limpio.length;
      input.value = limpio;
      const nuevaPosicion = Math.max(0, posicion - eliminados);
      input.setSelectionRange(nuevaPosicion, nuevaPosicion);
    }

    this.valor = limpio ? Number(limpio) : null;
    this.onChange(this.valor);
  }

  @HostListener('blur')
  onBlur(): void {
    this.el.nativeElement.value = this.valor != null ? String(this.valor) : '';
    this.onTouched();
  }

  writeValue(valor: unknown): void {
    const n = valor == null || valor === '' ? null : Number(valor);
    this.valor = n != null && Number.isFinite(n) ? n : null;
    this.el.nativeElement.value = this.valor != null ? String(this.valor) : '';
  }

  registerOnChange(fn: (v: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.el.nativeElement.disabled = disabled;
  }
}

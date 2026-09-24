import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Directive({
  selector: '[appCurrencyInput]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyInputDirective),
      multi: true
    }
  ]
})
export class CurrencyInputDirective implements ControlValueAccessor {
  private valor: number | null = null;
  private onTouched: () => void = () => {};
  private onChange: (v: number | null) => void = () => {};

  constructor(private el: ElementRef<HTMLInputElement>) {
    this.el.nativeElement.inputMode = 'decimal';
    this.el.nativeElement.type = 'text';
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const numero = this.parsear(input.value);
    this.valor = numero;
    this.onChange(numero);
  }

  @HostListener('blur')
  onBlur(): void {
    this.el.nativeElement.value = this.formatear(this.valor);
    this.onTouched();
  }

  @HostListener('focus')
  onFocus(): void {
    if (this.valor != null) {
      this.el.nativeElement.value = String(this.valor);
      this.el.nativeElement.select();
    }
  }

  writeValue(valor: unknown): void {
    this.valor = this.coercer(valor);
    this.el.nativeElement.value = this.formatear(this.valor);
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

  private parsear(texto: string): number | null {
    if (texto == null) return null;
    const limpio = texto.replace(/,/g, '').trim();
    if (!limpio) return null;
    const n = Number(limpio);
    return Number.isFinite(n) ? n : null;
  }

  private coercer(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private formatear(n: number | null): string {
    if (n == null) return '';
    return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
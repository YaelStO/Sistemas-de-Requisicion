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
    this.el.nativeElement.autocomplete = 'off';
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;

    if (/\d/.test(event.key)) return;

    if (event.key === '.') {
      const input = event.target as HTMLInputElement;
      const seleccion = input.value.substring(input.selectionStart ?? 0, input.selectionEnd ?? 0);
      if (input.value.includes('.') && !seleccion.includes('.')) {
        event.preventDefault();
      }
      return;
    }

    event.preventDefault();
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const original = input.value;
    const limpio = this.sanitizar(original);

    if (limpio !== original) {
      const posicion = input.selectionStart ?? limpio.length;
      const eliminados = original.length - limpio.length;
      input.value = limpio;
      const nuevaPosicion = Math.max(0, posicion - eliminados);
      input.setSelectionRange(nuevaPosicion, nuevaPosicion);
    }

    this.valor = this.parsear(limpio);
    this.onChange(this.valor);
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

  private sanitizar(texto: string): string {
    let limpio = texto.replace(/[^\d.]/g, '');
    const partes = limpio.split('.');
    if (partes.length > 2) {
      limpio = partes[0] + '.' + partes.slice(1).join('');
    }
    if (limpio.startsWith('.')) {
      limpio = '0' + limpio;
    }
    const [entero, decimales] = limpio.split('.');
    if (decimales !== undefined) {
      limpio = entero + '.' + decimales.slice(0, 2);
    }
    return limpio;
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

import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import type { TicketAncho } from '../../../shared/types'

interface TicketPreviewModalProps {
  open: boolean
  title: string
  html: string
  anchoTicket: TicketAncho
  isPrinting?: boolean
  onClose: () => void
  onPrint: () => void
}

export function TicketPreviewModal({
  open,
  title,
  html,
  anchoTicket,
  isPrinting = false,
  onClose,
  onPrint,
}: TicketPreviewModalProps): JSX.Element | null {
  const previewWidth = anchoTicket === '58mm' ? 250 : 340

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-slate-200 bg-slate-100 p-4 overflow-auto max-h-[62vh]">
          <iframe
            title={title}
            srcDoc={html}
            className="mx-auto bg-white shadow-sm border border-slate-200"
            style={{ width: previewWidth, height: 620 }}
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={onPrint} disabled={isPrinting}>
            {isPrinting ? 'Imprimiendo...' : 'Imprimir'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

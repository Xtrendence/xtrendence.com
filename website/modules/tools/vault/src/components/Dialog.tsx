import { type ReactNode, useEffect, useRef } from "react";

type TProps = {
	eyebrow: string;
	title: string;
	onClose?: () => void;
	wide?: boolean;
	children: ReactNode;
};

export function Dialog({ eyebrow, title, onClose, wide, children }: TProps) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (dialog && !dialog.open) {
			dialog.showModal();
			dialog.focus();
		}
	}, []);

	return (
		<dialog
			ref={ref}
			className={`dialog glass${wide ? " dialog--wide" : ""}`}
			tabIndex={-1}
			onCancel={(event) => {
				event.preventDefault();
				onClose?.();
			}}
			onClick={(event) => {
				if (event.target === ref.current) {
					onClose?.();
				}
			}}
		>
			<div className="dialog-head">
				<span className="eyebrow">{eyebrow}</span>
				<h2>{title}</h2>
			</div>
			{children}
		</dialog>
	);
}

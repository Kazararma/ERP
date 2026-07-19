import { BagDivision } from "@/types/deal";
import { BAG_SIZE_LABEL } from "@/types/riceTypes";

export function BagBreakdownDisplay({ divisions }: { divisions: BagDivision[] }) {
  if (!divisions || divisions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t mt-4">
      <div className="w-full text-xs font-bold text-slate-500 mb-1">BAG BREAKDOWN:</div>
      {divisions.map(div => (
        <div key={div.divisionId} className="flex flex-col border rounded-lg p-2 bg-slate-50 text-sm w-[200px]">
          <div className="font-bold text-slate-800">{BAG_SIZE_LABEL[div.bagSize]} × {div.numberOfBags} bags</div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-slate-500">Available: <span className="font-semibold text-slate-700">{div.availableBags}</span></span>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
              div.status === "ready" ? "bg-green-100 text-green-700" :
              div.status === "partial" ? "bg-yellow-100 text-yellow-700" :
              "bg-gray-200 text-gray-500"
            }`}>
              {div.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

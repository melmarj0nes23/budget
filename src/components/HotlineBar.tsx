const hotlines = [
  { icon: 'bi-shield-fill', label: 'Alcala Police', number: '0922-3855616', tel: '09223855616' },
  { icon: 'bi-fire', label: 'Alcala Fire (BFP)', number: '0917-1893611', tel: '09171893611' },
  { icon: 'bi-truck-front-fill', label: 'Ambulance', number: '0946-798-0534', tel: '09467980534' },
  { icon: 'bi-exclamation-triangle-fill', label: 'MDRRMO', number: '0920-9817724', tel: '09209817724' },
  { icon: 'bi-heart-pulse-fill', label: 'Municipal Health', number: '0917-8616986', tel: '09178616986' },
  { icon: 'bi-people-fill', label: 'DSWD-Alcala', number: '0918-3940809', tel: '09183940809' },
  { icon: 'bi-building', label: 'Municipal Hall', number: '(075) 632-5938', tel: '+63756325938' },
  { icon: 'bi-telephone-fill', label: 'Emergency', number: '911', tel: '911' },
  { icon: 'bi-megaphone-fill', label: 'ARTA / PCC', number: '8888', tel: '8888' },
];

export default function HotlineBar() {
  // Four repeats split cleanly across two identical halves (-50% CSS translate)
  // so the single-line ticker loops seamlessly on wide desktop and mobile screens.
  const passes = [0, 1, 2, 3];

  return (
    <div className="hotline-bar" role="region" aria-label="Emergency hotlines">
      <div className="container">
        <div className="hotline-inner">
          <div className="hotline-items">
            <div className="hotline-items-track">
              {passes.map((passIdx) =>
                hotlines.map((h) => {
                  const isDuplicate = passIdx > 0;
                  return (
                    <a
                      key={`${passIdx}-${h.label}-${h.tel}`}
                      href={`tel:${h.tel}`}
                      className="hotline-item"
                      aria-hidden={isDuplicate ? 'true' : undefined}
                      tabIndex={isDuplicate ? -1 : undefined}
                    >
                      <i className={`bi ${h.icon}`} aria-hidden="true" />
                      <span>
                        {h.label}: {h.number}
                      </span>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

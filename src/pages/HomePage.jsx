import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { countryToFlag } from "../flags";
import { useReignTimer } from "../useReignTimer";
import AuraWidget from "../AuraWidget";
import OutbidModal from "../OutbidModal";
import WavingFlag from "../WavingFlag";
import SocialLinks from "../SocialLinks";
import person01 from "../assets/01person.png";
import person02 from "../assets/02person.png";
import person03 from "../assets/03person.png";
import person04 from "../assets/04person.png";
import person05 from "../assets/05person.png";
import person06 from "../assets/06person.png";
import person07 from "../assets/07person.png";
import person08 from "../assets/08person.png";

const imageMap = {
  "01person": person01,
  "02person": person02,
  "03person": person03,
  "04person": person04,
  "05person": person05,
  "06person": person06,
  "07person": person07,
  "08person": person08,
};

function getImageSrc(item) {
  return item.image_url || imageMap[item.image_key];
}

function TitleCard({ item, selectedTitle, setSelectedTitle }) {
  return (
    <button
      className={`title-card ${
        selectedTitle?.id === item.id ? "active" : ""
      }`}
      onClick={() => setSelectedTitle(item)}
    >
      <div className="card-number">
        #{String(item.id).padStart(2, "0")}
      </div>

      <div className="card-flag">{countryToFlag(item.holder_country)}</div>

      <img
        className="mini-wadiya-person"
        src={getImageSrc(item)}
        alt={item.title}
      />

      <div className="card-content">
        <h3>{item.title}</h3>

        <div className="card-meta">
          <span>{item.holder}</span>
          <strong>${item.price.toLocaleString()}</strong>
        </div>
      </div>
    </button>
  );
}

function ReignBadge({ reignStartedAt }) {
  const elapsed = useReignTimer(reignStartedAt);
  return <div className="reign-badge">Period of Your Reign: {elapsed}</div>;
}

export default function HomePage() {
  const { currentUser, handleSignIn } = useOutletContext();

  const [titles, setTitles] = useState([]);
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    async function fetchTitles() {
      const { data, error } = await supabase
        .from("titles")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setTitles(data);
        setSelectedTitle((prev) => prev ?? data[2] ?? data[0]);
      }

      setLoading(false);
    }

    fetchTitles();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("titles-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "titles" },
        (payload) => {
          setTitles((prev) =>
            prev.map((t) => (t.id === payload.new.id ? payload.new : t))
          );

          setSelectedTitle((prev) =>
            prev && prev.id === payload.new.id ? payload.new : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const leftTitles = titles.slice(0, 4);
  const rightTitles = titles.slice(4, 8);

  const handleOutbidComplete = async ({
    userId,
    bidder,
    amount,
    country,
    address,
    favouriteQuote,
    imageUrl,
  }) => {
    const { error: bidError } = await supabase.from("bids").insert({
      title_id: selectedTitle.id,
      user_id: userId,
      bidder,
      amount,
      country,
      address,
      favourite_quote: favouriteQuote,
    });

    if (bidError) throw bidError;

    const { error: titleError } = await supabase
      .from("titles")
      .update({ image_url: imageUrl })
      .eq("id", selectedTitle.id);

    if (titleError) throw titleError;

    const updated = {
      ...selectedTitle,
      holder: bidder,
      price: amount,
      holder_country: country,
      holder_address: address,
      holder_quote: favouriteQuote,
      holder_user_id: userId,
      image_url: imageUrl,
      reign_started_at: new Date().toISOString(),
      aura: 0,
    };

    setSelectedTitle(updated);
    setTitles((prev) =>
      prev.map((t) => (t.id === selectedTitle.id ? updated : t))
    );
  };

  if (loading) {
    return (
      <main>
        <section className="hero">
          <p className="eyebrow hero-eyebrow">LOADING...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <section className="hero">
          <p className="eyebrow hero-eyebrow">ERROR</p>
          <h1>Couldn't load titles</h1>
          <p className="hero-description">{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            THE INTERNET'S MOST UNHINGED MARKETPLACE
          </p>

          <h1>
            <span className="hero-line-one">BUY A TITLE.</span>
            <span className="hero-line-two">BECOME LEGENDARY.</span>
          </h1>

          <p className="hero-description">
            Eight titles. One holder each. Outbid them. Take their identity.
          </p>

          {!currentUser ? (
            <button
              className="hero-cta"
              onClick={handleSignIn}
              type="button"
            >
              GET STARTED
              <span>→</span>
            </button>
          ) : (
            <button
              className="hero-cta"
              onClick={() =>
                document
                  .querySelector(".titles-section")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              type="button"
            >
              Browse Titles
              <span>→</span>
            </button>
          )}
        </div>

        {selectedTitle && (
          <div className="hero-visual">
            <div className="hero-visual-glow" />
            <img
              className="hero-visual-person"
              src={getImageSrc(selectedTitle)}
              alt={selectedTitle.title}
            />
          </div>
        )}
      </section>

      <section className="titles-section">
        <div className="titles-header">
          <div>
            <p className="eyebrow">CHOOSE YOUR DESTINY</p>
            <h2>THE 8 TITLES</h2>
          </div>

          <span className="active-count">08 ACTIVE</span>
        </div>

        <div className="battle-layout">
          <div className="side-grid left-grid">
            {leftTitles.map((item) => (
              <TitleCard
                key={item.id}
                item={item}
                selectedTitle={selectedTitle}
                setSelectedTitle={setSelectedTitle}
              />
            ))}
          </div>

          <div className="character-stage">
            <div className="stage-glow" />

            {selectedTitle && (
              <>
                <div className="wadiya-tag">
                  <span>{selectedTitle.holder}</span>
                  <strong>{selectedTitle.title}</strong>
                </div>

                <div className="wadiya-pointer">
                  <span />
                </div>

                <img
                  className="giant-person"
                  src={getImageSrc(selectedTitle)}
                  alt={selectedTitle.title}
                />
              </>
            )}
          </div>

          <div className="side-grid right-grid">
            {rightTitles.map((item) => (
              <TitleCard
                key={item.id}
                item={item}
                selectedTitle={selectedTitle}
                setSelectedTitle={setSelectedTitle}
              />
            ))}
          </div>
        </div>
      </section>

      {selectedTitle && (
        <section className="auction wadiya-active">
          <div className="auction-info">
            <div className="auction-top">
              <div className="auction-top-left">
                <span className="live-badge">
                  <i />
                  LIVE AUCTION
                </span>

                <span className="auction-number">
                  #{String(selectedTitle.id).padStart(2, "0")}
                </span>
              </div>

              <ReignBadge reignStartedAt={selectedTitle.reign_started_at} />
            </div>

            <div className="auction-content">
              <div className="holder-block big-holder-block">
                <p className="small-label">CURRENT HOLDER</p>

                <div className="holder-row">
                  <div className="holder-details">
                    <strong className="holder-name-big">
                      {selectedTitle.holder}
                    </strong>

                    <p className="holder-address-big">
                      📍 {selectedTitle.holder_country || "Unknown"}
                      {selectedTitle.holder_address
                        ? `, ${selectedTitle.holder_address}`
                        : ""}
                    </p>
                  </div>

                  <div className="holder-flag-big">
                    <WavingFlag
                      country={selectedTitle.holder_country}
                      width={72}
                      height={48}
                    />
                  </div>
                </div>

                <SocialLinks
                  titleId={selectedTitle.id}
                  instagram={selectedTitle.holder_instagram}
                  tiktok={selectedTitle.holder_tiktok}
                  isOwner={
                    Boolean(currentUser?.id) &&
                    currentUser.id === selectedTitle.holder_user_id
                  }
                  onUpdated={(updated) => {
                    setTitles((prev) =>
                      prev.map((t) => (t.id === updated.id ? updated : t))
                    );

                    setSelectedTitle((prev) =>
                      prev && prev.id === updated.id ? updated : prev
                    );
                  }}
                />

                {selectedTitle.holder_quote && (
                  <p className="holder-quote-big">
                    "{selectedTitle.holder_quote}"
                  </p>
                )}
              </div>

              <AuraWidget
                titleId={selectedTitle.id}
                aura={selectedTitle.aura}
              />

              <div className="price-block">
                <div className="price">
                  ${selectedTitle.price.toLocaleString()}
                </div>

                <p className="small-label">CURRENT PRICE</p>
              </div>

              <button
                className="claim-button"
                onClick={() => setModalOpen(true)}
              >
                OUTBID FOR $
                {(selectedTitle.price + 5).toLocaleString()}
                <span>→</span>
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="bottom-note">
        <span>01 PICK A TITLE</span>
        <span>02 OUTBID THE HOLDER</span>
        <span>03 BECOME THE LEGEND</span>
      </div>

      {modalOpen && selectedTitle && (
        <OutbidModal
          selectedTitle={selectedTitle}
          minBid={selectedTitle.price + 5}
          onClose={() => setModalOpen(false)}
          onComplete={handleOutbidComplete}
        />
      )}
    </main>
  );
}